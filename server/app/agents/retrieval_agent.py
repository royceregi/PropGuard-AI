"""Blockchain Information Retrieval Agent.

Retrieves the ledger block, property anchor, documents, and registry records for one transaction,
runs the blockchain verification service, and returns the result as evidence JSON.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import agent_output, log_run
from app.services import blockchain_risk_service

AGENT_NAME = "blockchain_retrieval_agent"

_HASH_FLAGS = (
    "tx_hash_match",
    "transaction_data_hash_match",
    "previous_hash_match",
    "property_hash_match",
    "document_hash_match",
    "digital_signature_valid",
    "smart_contract_valid",
    "consensus_verified",
    "duplicate_tx_hash",
)


def _evidence_ids(evaluation: dict[str, Any]) -> list[str]:
    details = evaluation["verification"]["details"]
    ids = [f"blockchain_transactions:{details['blockchain_tx_id']}"]
    if details.get("property_id"):
        ids.append(f"properties:{details['property_id']}")
    ids += [f"property_documents:{doc['document_id']}" for doc in details.get("documents") or []]
    for check in (evaluation["registry_checks"] or {}).get("checks", []):
        for ev in check.get("evidence") or []:
            ref = f"{ev['table']}:{ev['id']}"
            if ev.get("id") and ref not in ids:
                ids.append(ref)
    return ids


def run(db: Session, transaction_id: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(agent output, full evaluation for the next agent). Evaluation is None when not found."""
    started = datetime.now()
    input_data = {"transaction_id": transaction_id}
    try:
        evaluation = blockchain_risk_service.evaluate(db, transaction_id)
    except Exception as exc:
        log_run(db, AGENT_NAME, input_data=input_data, output=None, started_at=started, error=str(exc))
        raise

    if evaluation is None:
        output = agent_output(
            AGENT_NAME,
            status="NOT_FOUND",
            confidence_score=0,
            findings={"transaction_id": transaction_id},
            evidence_ids=[],
            warnings=["No blockchain ledger record exists for this transaction."],
        )
        log_run(db, AGENT_NAME, input_data=input_data, output=output, started_at=started)
        return output, None

    verify = evaluation["verification"]
    checks = evaluation["registry_checks"] or {"checks": [], "counts": {}, "overall": None}
    total = len(checks["checks"])
    not_applicable = sum(1 for check in checks["checks"] if check["status"] == "NA")
    warnings: list[str] = []
    if verify["digital_signature_valid"] is None:
        warnings.append("Registry signature not checked: no public key configured.")
    if not_applicable:
        warnings.append(f"{not_applicable} of {total} registry checks were not applicable (missing data).")
    # Confidence = share of checks that had enough data to decide.
    confidence = 1.0 if total == 0 else (total - not_applicable) / total

    output = agent_output(
        AGENT_NAME,
        status="COMPLETED",
        confidence_score=confidence,
        findings={
            "transaction_id": evaluation["transaction_id"],
            "property_id": evaluation["property_id"],
            "integrity": evaluation["integrity"],
            "hash_checks": {flag: verify[flag] for flag in _HASH_FLAGS},
            "chain_position": verify["details"]["chain_position"],
            "is_chain_head": verify["details"]["is_chain_head"],
            "property_changes": verify["details"].get("property_changes") or [],
            "documents": verify["details"].get("documents") or [],
            "registry_checks": {
                "overall": checks.get("overall"),
                "counts": checks.get("counts", {}),
                "failed": [
                    {"code": c["code"], "status": c["status"], "reason": c["reason"]}
                    for c in checks["checks"]
                    if c["status"] in ("FAIL", "WARN")
                ],
            },
            "features": evaluation["features"],
        },
        evidence_ids=_evidence_ids(evaluation),
        warnings=warnings,
    )
    log_run(db, AGENT_NAME, input_data=input_data, output=output, started_at=started)
    return output, evaluation
