"""Turn blockchain verification (Steps 1–4) and registry checks into risk features and indicators.

evaluate()           → run every check for one transaction; return features + indicators (no writes)
upsert_features()    → write the blockchain columns of core.transaction_features
assess_transaction() → evaluate, upsert features, store core.risk_assessments + core.risk_indicators

Scores use the project scale in 06-risk-detection.md (0–1; LOW < 0.40 ≤ MEDIUM < 0.70 ≤ HIGH).
The result is a risk indicator for investigation, not a legal fraud judgment.
"""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.property import BlockchainTransaction, PropertyTransaction
from app.models.risk_assessment import RiskAssessment, RiskIndicator, TransactionFeature
from app.services import blockchain_hash_service, registry_checks_service

MODEL_NAME = "blockchain-rules"
MODEL_VERSION = "1.0"

FEATURE_COLUMNS = (
    "hash_chain_valid",
    "seller_matches_owner",
    "has_active_encumbrance",
    "property_hash_match",
    "transaction_hash_match",
    "document_hash_match",
    "digital_signature_valid",
    "smart_contract_valid",
    "blockchain_transaction_confirmed",
    "duplicate_blockchain_tx",
    "from_wallet_matches_seller",
    "to_wallet_matches_buyer",
    "buyer_matches_new_owner",
    "blockchain_value_matches_db",
    "blockchain_type_matches_db",
    "blockchain_timestamp_valid",
    "blockchain_integrity",
    "blockchain_checked_at",
)

# Ledger-integrity indicators: (code, name, weight, description). Any of these means tampering.
_INTEGRITY_RULES: dict[str, tuple[str, str, float, str]] = {
    "chain": (
        "BROKEN_HASH_CHAIN",
        "Broken hash chain",
        0.5,
        "The block no longer links to the previous block, or its tx_hash does not match its contents.",
    ),
    "transaction": (
        "TRANSACTION_HASH_MISMATCH",
        "Transaction data changed",
        0.5,
        "The recorded transaction details no longer match the transaction data hash on the ledger.",
    ),
    "property": (
        "PROPERTY_HASH_MISMATCH",
        "Property record changed",
        0.4,
        "The property record no longer matches the property hash anchored on the ledger.",
    ),
    "document": (
        "DOCUMENT_HASH_MISMATCH",
        "Document hash mismatch",
        0.4,
        "A document's text no longer matches its recorded SHA-256 hash.",
    ),
    "signature": (
        "INVALID_DIGITAL_SIGNATURE",
        "Invalid registry signature",
        0.5,
        "The block is not signed by the land-registry key.",
    ),
    "contract": (
        "UNKNOWN_SMART_CONTRACT",
        "Unknown smart contract",
        0.4,
        "The block was not written by the registry smart contract.",
    ),
    "duplicate": (
        "DUPLICATE_BLOCKCHAIN_TX",
        "Duplicate block hash",
        0.4,
        "Another block carries the same transaction hash.",
    ),
}

# Registry check → (indicator code, name, weight on FAIL, weight on WARN).
_REGISTRY_RULES: dict[str, tuple[str, str, float, float]] = {
    "TX_RECORDED_BOTH": ("MISSING_LEDGER_RECORD", "Missing registry or ledger record", 0.4, 0.0),
    "PROPERTY_CONSISTENT": ("LEDGER_PROPERTY_MISMATCH", "Ledger property mismatch", 0.4, 0.0),
    "VALUE_MATCH": ("BLOCKCHAIN_VALUE_MISMATCH", "Ledger value mismatch", 0.3, 0.0),
    "TYPE_CONSISTENT": ("BLOCKCHAIN_TYPE_MISMATCH", "Ledger type mismatch", 0.2, 0.0),
    "TIMESTAMP_TOLERANCE": (
        "BLOCKCHAIN_TIMESTAMP_MISMATCH",
        "Ledger timestamp mismatch",
        0.15,
        0.0,
    ),
    "LEDGER_CONFIRMED": ("UNCONFIRMED_BLOCKCHAIN_TX", "Ledger transaction not confirmed", 0.3, 0.1),
    "SELLER_WALLET": ("SELLER_WALLET_MISMATCH", "Seller wallet mismatch", 0.3, 0.0),
    "BUYER_WALLET": ("BUYER_WALLET_MISMATCH", "Buyer wallet mismatch", 0.3, 0.0),
    "REQUIRED_PARTIES": ("MISSING_REQUIRED_PARTY", "Missing required party", 0.15, 0.05),
    "BUYER_BECAME_OWNER": ("BUYER_NOT_NEW_OWNER", "Buyer did not become owner", 0.3, 0.0),
    # Kept low: in this synthetic dataset the seller is rarely the earlier owner of record.
    "SELLER_WAS_OWNER": ("SELLER_NOT_CURRENT_OWNER", "Seller was not the owner", 0.15, 0.0),
    "SINGLE_ACTIVE_OWNER": ("MULTIPLE_ACTIVE_OWNERS", "Conflicting active owners", 0.3, 0.0),
    "CURRENT_OWNER_CONSISTENT": (
        "OWNER_RECORD_INCONSISTENT",
        "Owner record inconsistent",
        0.1,
        0.05,
    ),
    "ENCUMBRANCE": ("ACTIVE_ENCUMBRANCE", "Active encumbrance", 0.3, 0.1),
    "REGISTRATION": ("REGISTRATION_ISSUE", "Registration issue", 0.3, 0.1),
}

# Registry check code → feature column (PASS → true, FAIL → false, WARN/NA → NULL unless noted).
_CHECK_FEATURES = {
    "SELLER_WALLET": "from_wallet_matches_seller",
    "BUYER_WALLET": "to_wallet_matches_buyer",
    "BUYER_BECAME_OWNER": "buyer_matches_new_owner",
    "SELLER_WAS_OWNER": "seller_matches_owner",
    "VALUE_MATCH": "blockchain_value_matches_db",
    "TYPE_CONSISTENT": "blockchain_type_matches_db",
    "TIMESTAMP_TOLERANCE": "blockchain_timestamp_valid",
}


def risk_level(score: float) -> str:
    if score < 0.40:
        return "LOW"
    if score < 0.70:
        return "MEDIUM"
    return "HIGH"


def _severity(weight: float) -> str:
    if weight >= 0.4:
        return "HIGH"
    if weight >= 0.2:
        return "MEDIUM"
    return "LOW"


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _indicator(
    code: str,
    name: str,
    weight: float,
    description: str,
    evidence: list[dict[str, Any]],
    source: str,
) -> dict[str, Any]:
    return {
        "indicator_code": code,
        "indicator_name": name,
        "indicator_value": weight,
        "severity": _severity(weight),
        "description": description,
        "source": source,
        "evidence": evidence,
    }


def _ledger_evidence(verify: dict[str, Any]) -> dict[str, Any]:
    return {"table": "blockchain_transactions", "id": str(verify["details"]["blockchain_tx_id"])}


def _integrity_indicators(verify: dict[str, Any]) -> list[dict[str, Any]]:
    d = verify["details"]
    ledger = _ledger_evidence(verify)
    found: list[dict[str, Any]] = []

    def add(key: str, evidence: list[dict[str, Any]]) -> None:
        code, name, weight, description = _INTEGRITY_RULES[key]
        found.append(
            _indicator(code, name, weight, description, evidence, "blockchain_verification")
        )

    chain_evidence = []
    if not verify["previous_hash_match"]:
        chain_evidence.append(
            {
                **ledger,
                "field": "previous_hash",
                "expected": d["expected_previous_hash"],
                "actual": d["previous_hash"],
            }
        )
    if not verify["tx_hash_match"]:
        chain_evidence.append(
            {
                **ledger,
                "field": "tx_hash",
                "expected": d["recomputed_tx_hash"],
                "actual": d["tx_hash"],
            }
        )
    if chain_evidence:
        add("chain", chain_evidence)
    if not verify["transaction_data_hash_match"]:
        add(
            "transaction",
            [
                {
                    **ledger,
                    "field": "transaction_data_hash",
                    "expected": d["recomputed_transaction_data_hash"],
                    "actual": d["transaction_data_hash"],
                }
            ],
        )
    if not verify["property_hash_match"]:
        changes = d.get("property_changes") or []
        evidence = [
            {
                "table": "properties",
                "id": d["property_id"],
                "field": c["field"],
                "expected": _jsonable(c["anchored"]),
                "actual": _jsonable(c["current"]),
            }
            for c in changes
        ] or [
            {
                **ledger,
                "field": "property_hash",
                "expected": d["recomputed_property_hash"],
                "actual": d["property_hash"],
            }
        ]
        add("property", evidence)
    if not verify["document_hash_match"]:
        add(
            "document",
            [
                {
                    "table": "property_documents",
                    "id": str(doc["document_id"]),
                    "field": "document_hash",
                    "expected": doc["recomputed_document_hash"],
                    "actual": doc["document_hash"],
                }
                for doc in d.get("documents") or []
                if doc["match"] is False
            ],
        )
    if verify["digital_signature_valid"] is False:
        add(
            "signature",
            [
                {
                    **ledger,
                    "field": "digital_signature",
                    "expected": "valid registry signature",
                    "actual": d.get("digital_signature"),
                }
            ],
        )
    if not verify["smart_contract_valid"]:
        add(
            "contract",
            [
                {
                    **ledger,
                    "field": "smart_contract_address",
                    "expected": d.get("expected_smart_contract_address"),
                    "actual": d.get("smart_contract_address"),
                }
            ],
        )
    if verify["duplicate_tx_hash"]:
        add(
            "duplicate",
            [{**ledger, "field": "tx_hash", "expected": "unique", "actual": d["tx_hash"]}],
        )
    return found


def _registry_indicators(checks: dict[str, Any]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for check in checks["checks"]:
        rule = _REGISTRY_RULES.get(check["code"])
        if rule is None or check["status"] not in ("FAIL", "WARN"):
            continue
        code, name, fail_weight, warn_weight = rule
        weight = fail_weight if check["status"] == "FAIL" else warn_weight
        if weight <= 0:
            continue
        evidence = [
            {
                **ev,
                "field": check["code"],
                "expected": _jsonable(check.get("expected")),
                "actual": _jsonable(check.get("actual")),
            }
            for ev in check.get("evidence") or []
        ] or [
            {
                "table": "registry_checks",
                "id": check["code"],
                "expected": _jsonable(check.get("expected")),
                "actual": _jsonable(check.get("actual")),
            }
        ]
        found.append(_indicator(code, name, weight, check["reason"], evidence, "registry_checks"))
    return found


def _features(verify: dict[str, Any], checks: dict[str, Any] | None) -> dict[str, Any]:
    features: dict[str, Any] = {
        "hash_chain_valid": bool(verify["previous_hash_match"] and verify["tx_hash_match"]),
        "property_hash_match": verify["property_hash_match"],
        "transaction_hash_match": verify["transaction_data_hash_match"],
        "document_hash_match": verify["document_hash_match"],
        "digital_signature_valid": verify["digital_signature_valid"],
        "smart_contract_valid": verify["smart_contract_valid"],
        "blockchain_transaction_confirmed": verify["consensus_verified"],
        "duplicate_blockchain_tx": verify["duplicate_tx_hash"],
        "blockchain_integrity": verify["integrity"],
        "blockchain_checked_at": datetime.now(),
        "has_active_encumbrance": None,
    }
    for column in _CHECK_FEATURES.values():
        features[column] = None
    if checks is not None:
        by_code = {check["code"]: check["status"] for check in checks["checks"]}
        for code, column in _CHECK_FEATURES.items():
            status = by_code.get(code)
            features[column] = True if status == "PASS" else False if status == "FAIL" else None
        encumbrance = by_code.get("ENCUMBRANCE")
        if encumbrance in ("PASS", "WARN", "FAIL"):
            features["has_active_encumbrance"] = encumbrance != "PASS"
    return features


def evaluate(db: Session, transaction_id: str) -> dict[str, Any] | None:
    """Run Steps 1–4 + registry checks for one transaction. None if it has no ledger row."""
    verify = blockchain_hash_service.verify_transaction(db, transaction_id)
    if verify is None:
        return None
    checks = registry_checks_service.run_checks(db, transaction_id)
    indicators = _integrity_indicators(verify)
    if checks is not None:
        indicators += _registry_indicators(checks)

    score = round(min(1.0, sum(item["indicator_value"] for item in indicators)), 2)
    return {
        "transaction_id": verify["details"]["transaction_id"],
        "property_id": verify["details"]["property_id"],
        "integrity": verify["integrity"],
        "risk_score": score,
        "risk_level": risk_level(score),
        "features": _features(verify, checks),
        "indicators": sorted(indicators, key=lambda item: -item["indicator_value"]),
        "verification": verify,
        "registry_checks": checks,
    }


def _property_id_for(db: Session, transaction_id: str, fallback: str | None) -> str | None:
    tx = (
        db.query(PropertyTransaction.property_id)
        .filter(PropertyTransaction.transaction_id == transaction_id)
        .first()
    )
    return (tx[0] if tx else None) or fallback


def upsert_features(db: Session, evaluation: dict[str, Any], *, commit: bool = True) -> bool:
    """Write the blockchain feature columns. False when the transaction isn't in the registry (FK)."""
    tid = evaluation["transaction_id"]
    exists = (
        db.query(PropertyTransaction.transaction_id)
        .filter(PropertyTransaction.transaction_id == tid)
        .first()
    )
    property_id = _property_id_for(db, tid, evaluation["property_id"])
    if exists is None or not property_id:
        return False
    values = {column: evaluation["features"][column] for column in FEATURE_COLUMNS}
    db.execute(
        pg_insert(TransactionFeature)
        .values(transaction_id=tid, property_id=property_id, **values)
        .on_conflict_do_update(index_elements=["transaction_id"], set_=values)
    )
    if commit:
        db.commit()
    return True


def _explanation(evaluation: dict[str, Any]) -> str:
    indicators = evaluation["indicators"]
    head = (
        f"Blockchain integrity {evaluation['integrity']}. "
        f"Risk {evaluation['risk_level']} ({evaluation['risk_score']:.2f}) from {len(indicators)} indicator(s)."
    )
    if not indicators:
        return head + " No blockchain or registry issues found."
    reasons = "; ".join(
        f"{item['indicator_code']}: {item['description']}" for item in indicators[:5]
    )
    return f"{head} {reasons} This is a risk indicator, not a legal fraud judgment."


def assess_transaction(
    db: Session,
    transaction_id: str,
    *,
    evaluation: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Evaluate (unless given), upsert features, and store an assessment with its indicators."""
    evaluation = evaluation or evaluate(db, transaction_id)
    if evaluation is None:
        return None
    tid = evaluation["transaction_id"]
    property_id = _property_id_for(db, tid, evaluation["property_id"])
    in_registry = (
        db.query(PropertyTransaction.transaction_id)
        .filter(PropertyTransaction.transaction_id == tid)
        .first()
        is not None
    )
    if not in_registry or not property_id:
        # risk_assessments.transaction_id references property_transactions.
        return {**_serialize_evaluation(evaluation), "assessment_id": None, "stored": False}

    upsert_features(db, evaluation, commit=False)
    assessment = RiskAssessment(
        transaction_id=tid,
        property_id=property_id,
        risk_score=Decimal(str(evaluation["risk_score"])),
        risk_level=evaluation["risk_level"],
        model_name=MODEL_NAME,
        model_version=MODEL_VERSION,
        assessment_status="Completed",
        explanation=_explanation(evaluation),
        review_status="Pending Review",
    )
    db.add(assessment)
    db.flush()
    for item in evaluation["indicators"]:
        db.add(
            RiskIndicator(
                assessment_id=assessment.assessment_id,
                indicator_code=item["indicator_code"],
                indicator_name=item["indicator_name"],
                indicator_value=Decimal(str(item["indicator_value"])),
                severity=item["severity"],
                description=item["description"],
                evidence_reference=json.dumps(item["evidence"], default=str),
            )
        )
    db.commit()
    return get_latest_assessment(db, tid)


def _serialize_evaluation(evaluation: dict[str, Any]) -> dict[str, Any]:
    return {
        "transaction_id": evaluation["transaction_id"],
        "property_id": evaluation["property_id"],
        "integrity": evaluation["integrity"],
        "risk_score": evaluation["risk_score"],
        "risk_level": evaluation["risk_level"],
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "explanation": _explanation(evaluation),
        "created_at": None,
        "indicators": [
            {
                key: item[key]
                for key in (
                    "indicator_code",
                    "indicator_name",
                    "indicator_value",
                    "severity",
                    "description",
                    "evidence",
                )
            }
            for item in evaluation["indicators"]
        ],
    }


def _parse_evidence(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except ValueError:
        return [{"table": None, "id": raw}]
    return parsed if isinstance(parsed, list) else [parsed]


def get_latest_assessment(db: Session, transaction_id: str) -> dict[str, Any] | None:
    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.transaction_id == transaction_id,
            RiskAssessment.model_name == MODEL_NAME,
        )
        .order_by(RiskAssessment.assessment_id.desc())
        .first()
    )
    if assessment is None:
        return None
    indicators = (
        db.query(RiskIndicator)
        .filter(RiskIndicator.assessment_id == assessment.assessment_id)
        .order_by(RiskIndicator.indicator_value.desc(), RiskIndicator.indicator_id.asc())
        .all()
    )
    features = (
        db.query(TransactionFeature)
        .filter(TransactionFeature.transaction_id == transaction_id)
        .first()
    )
    ledger = (
        db.query(BlockchainTransaction.property_id)
        .filter(BlockchainTransaction.transaction_id == transaction_id)
        .first()
    )
    return {
        "assessment_id": assessment.assessment_id,
        "stored": True,
        "transaction_id": assessment.transaction_id,
        "property_id": assessment.property_id or (ledger[0] if ledger else None),
        "integrity": features.blockchain_integrity if features else None,
        "risk_score": float(assessment.risk_score) if assessment.risk_score is not None else None,
        "risk_level": assessment.risk_level,
        "model_name": assessment.model_name,
        "model_version": assessment.model_version,
        "explanation": assessment.explanation,
        "review_status": assessment.review_status,
        "created_at": assessment.created_at,
        "features": {column: getattr(features, column) for column in FEATURE_COLUMNS}
        if features
        else None,
        "indicators": [
            {
                "indicator_code": item.indicator_code,
                "indicator_name": item.indicator_name,
                "indicator_value": float(item.indicator_value)
                if item.indicator_value is not None
                else None,
                "severity": item.severity,
                "description": item.description,
                "evidence": _parse_evidence(item.evidence_reference),
            }
            for item in indicators
        ],
    }


def refresh_features(db: Session, transaction_ids: list[str]) -> dict[str, int]:
    """Batch feature refresh (no assessments). Commits every 500 rows."""
    written = skipped = 0
    for index, tid in enumerate(transaction_ids, start=1):
        evaluation = evaluate(db, tid)
        if evaluation is not None and upsert_features(db, evaluation, commit=False):
            written += 1
        else:
            skipped += 1
        if index % 500 == 0:
            db.commit()
    db.commit()
    return {"written": written, "skipped": skipped}


def ensure_feature_columns(conn: Any) -> None:
    """Idempotently add the sql/012 columns (create_all never alters existing tables).
    Takes a Connection or Session; the caller commits."""
    columns = {
        "property_hash_match": "BOOLEAN",
        "transaction_hash_match": "BOOLEAN",
        "document_hash_match": "BOOLEAN",
        "digital_signature_valid": "BOOLEAN",
        "smart_contract_valid": "BOOLEAN",
        "blockchain_transaction_confirmed": "BOOLEAN",
        "duplicate_blockchain_tx": "BOOLEAN",
        "from_wallet_matches_seller": "BOOLEAN",
        "to_wallet_matches_buyer": "BOOLEAN",
        "buyer_matches_new_owner": "BOOLEAN",
        "blockchain_value_matches_db": "BOOLEAN",
        "blockchain_type_matches_db": "BOOLEAN",
        "blockchain_timestamp_valid": "BOOLEAN",
        "blockchain_integrity": "VARCHAR(10)",
        "blockchain_checked_at": "TIMESTAMP",
    }
    clauses = ", ".join(f"ADD COLUMN IF NOT EXISTS {name} {kind}" for name, kind in columns.items())
    conn.execute(text(f"ALTER TABLE core.transaction_features {clauses}"))


def _anomaly_indicators(transaction_id: str, result: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not result or not result.get("is_anomaly"):
        return []
    from app.services import anomaly_model_service

    ind = anomaly_model_service.indicator(transaction_id, result)
    return [
        {
            "indicator_code": ind["code"],
            "indicator_name": ind["name"],
            "indicator_value": ind["weight"],
            "severity": "MEDIUM",
            "description": ind["description"],
            "source": "anomaly_model",
            "evidence": ind["evidence"],
        }
    ]


def _model_version(result: dict[str, Any] | None) -> str:
    if not result:
        return MODEL_VERSION
    return f"{MODEL_VERSION}+{result.get('model_name', 'anomaly')}-{result.get('model_version', '1.0')}"
