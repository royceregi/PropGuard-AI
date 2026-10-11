"""Transaction Analysis Agent (Phase 6 / Phase 9c).

Analyzes the ledger hash integrity and registry consistency checks for a transaction,
producing a structured analysis of checks, ownership findings, hash findings, missing required fields,
and a confidence score based on data availability.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import agent_output, log_run
from app.services import registry_checks_service

AGENT_NAME = "transaction_analysis_agent"


def _extract_evidence_ids(checks: list[dict[str, Any]]) -> list[str]:
    evidence_ids: list[str] = []
    for check in checks:
        for ev in check.get("evidence") or []:
            if ev.get("table") and ev.get("id"):
                ref = f"{ev['table']}:{ev['id']}"
                if ref not in evidence_ids:
                    evidence_ids.append(ref)
    return evidence_ids


def run(
    db: Session,
    transaction_id: str,
    retrieval_output: dict[str, Any] | None = None,
    evaluation: dict[str, Any] | None = None,
    query_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Execute Transaction Analysis Agent.

    Reuses the registry checks already computed by the Retrieval Agent when ``evaluation``
    is supplied; runs them itself only when used standalone.

    Returns (agent_output_dict, findings_dict).
    """
    started = datetime.now()
    input_data: dict[str, Any] = {"transaction_id": transaction_id}
    if retrieval_output:
        input_data["from_agent"] = retrieval_output.get("agent_name")

    try:
        checks_result = (evaluation or {}).get("registry_checks")
        if checks_result is None:
            checks_result = registry_checks_service.run_checks(db, transaction_id)
    except Exception as exc:
        log_run(
            db,
            AGENT_NAME,
            input_data=input_data,
            output=None,
            started_at=started,
            error=str(exc),
            query_id=query_id,
        )
        raise

    if checks_result is None:
        output = agent_output(
            AGENT_NAME,
            status="NOT_FOUND",
            confidence_score=0.0,
            findings={"transaction_id": transaction_id},
            evidence_ids=[],
            warnings=["No registry or ledger transaction found to analyze."],
        )
        log_run(
            db,
            AGENT_NAME,
            input_data=input_data,
            output=output,
            started_at=started,
            query_id=query_id,
        )
        return output, {"transaction_id": transaction_id}

    checks = checks_result.get("checks", [])
    counts = checks_result.get("counts", {})
    overall = checks_result.get("overall", "FAIL")

    total = len(checks)
    na_count = counts.get("NA", 0)
    confidence = 1.0 if total == 0 else max(0.0, (total - na_count) / total)

    # Hash findings from retrieval/evaluation or checks
    hash_findings: dict[str, Any] = {}
    if retrieval_output and "findings" in retrieval_output:
        hash_findings = retrieval_output["findings"].get("hash_checks", {})
    elif evaluation and "verification" in evaluation:
        v = evaluation["verification"]
        hash_findings = {
            k: v.get(k)
            for k in (
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
        }

    # Extract ownership findings from checks
    ownership_checks = [c for c in checks if c.get("category") == "ownership"]
    ownership_findings = [
        {"code": c["code"], "name": c["name"], "status": c["status"], "reason": c["reason"]}
        for c in ownership_checks
    ]

    # Required fields missing
    missing_fields: list[str] = []
    for check in checks:
        if check.get("status") == "NA":
            missing_fields.append(f"{check.get('name')}: {check.get('reason')}")

    evidence_ids = _extract_evidence_ids(checks)
    warnings: list[str] = []
    if counts.get("FAIL", 0) > 0:
        warnings.append(f"{counts['FAIL']} registry check(s) failed.")
    if counts.get("WARN", 0) > 0:
        warnings.append(f"{counts['WARN']} registry check(s) generated warnings.")

    findings = {
        "transaction_id": transaction_id,
        "property_id": checks_result.get("property_id"),
        "overall": overall,
        "counts": counts,
        "checks": checks,
        "ownership_findings": ownership_findings,
        "hash_findings": hash_findings,
        "required_fields_missing": missing_fields,
    }

    output = agent_output(
        AGENT_NAME,
        status="COMPLETED",
        confidence_score=confidence,
        findings=findings,
        evidence_ids=evidence_ids,
        warnings=warnings,
    )
    log_run(
        db, AGENT_NAME, input_data=input_data, output=output, started_at=started, query_id=query_id
    )
    return output, findings
