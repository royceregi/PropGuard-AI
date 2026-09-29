"""Risk and Fraud Detection Agent.

Consumes the Retrieval Agent's evidence, scores it with the blockchain rule set, and stores a
risk assessment with one indicator per reason.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents import retrieval_agent
from app.agents.base import agent_output, log_run
from app.services import blockchain_risk_service

AGENT_NAME = "risk_detection_agent"


def run(
    db: Session,
    retrieval_output: dict[str, Any],
    evaluation: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(agent output, stored assessment)."""
    started = datetime.now()
    input_data = {
        "from_agent": retrieval_output["agent_name"],
        "transaction_id": evaluation["transaction_id"],
        "evidence_ids": retrieval_output["evidence_ids"],
    }
    try:
        assessment = blockchain_risk_service.assess_transaction(
            db, evaluation["transaction_id"], evaluation=evaluation
        )
    except Exception as exc:
        log_run(db, AGENT_NAME, input_data=input_data, output=None, started_at=started, error=str(exc))
        raise

    warnings = list(retrieval_output["warnings"])
    if assessment is not None and not assessment.get("stored"):
        warnings.append("Transaction is not in the registry, so the assessment was not stored.")
    indicators = (assessment or {}).get("indicators", [])
    output = agent_output(
        AGENT_NAME,
        status="COMPLETED",
        confidence_score=retrieval_output["confidence_score"],
        findings={
            "assessment_id": (assessment or {}).get("assessment_id"),
            "risk_score": (assessment or {}).get("risk_score"),
            "risk_level": (assessment or {}).get("risk_level"),
            "indicator_codes": [item["indicator_code"] for item in indicators],
            "explanation": (assessment or {}).get("explanation"),
        },
        evidence_ids=retrieval_output["evidence_ids"],
        warnings=warnings,
    )
    log_run(db, AGENT_NAME, input_data=input_data, output=output, started_at=started)
    return output, assessment


def investigate(db: Session, transaction_id: str) -> dict[str, Any] | None:
    """Retrieval Agent → Risk Agent. None when the transaction has no ledger record."""
    retrieval, evaluation = retrieval_agent.run(db, transaction_id)
    if evaluation is None:
        return None
    risk, assessment = run(db, retrieval, evaluation)
    return {"assessment": assessment, "agents": [retrieval, risk]}
