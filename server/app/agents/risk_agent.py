"""Risk and Fraud Detection Agent.

Consumes the Retrieval Agent's evidence, scores it with the blockchain rule set, and stores a
risk assessment with one indicator per reason.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents import retrieval_agent
from app.agents.base import agent_output, log_run
from app.core import llm
from app.services import blockchain_risk_service

AGENT_NAME = "risk_detection_agent"

_SYSTEM_PROMPT = """You are the Risk Review Agent for a land-registry investigation.
Review only the supplied rule-based assessment and evidence summary.
Do not recalculate or change the official risk score, and never claim fraud is proven.
Reply with JSON containing:
{"summary": "...", "key_concerns": ["..."], "recommended_actions": ["..."],
"suggested_level": "LOW|MEDIUM|HIGH"}"""


def run(
    db: Session,
    retrieval_output: dict[str, Any],
    evaluation: dict[str, Any],
    query_id: str | None = None,
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

    warnings = list(retrieval_output["warnings"])
    if assessment is not None and not assessment.get("stored"):
        warnings.append("Transaction is not in the registry, so the assessment was not stored.")
    indicators = (assessment or {}).get("indicators", [])
    ai_review: dict[str, Any] | None = None
    if llm.is_enabled():
        try:
            review_context = {
                "transaction_id": evaluation["transaction_id"],
                "rule_score": (assessment or {}).get("risk_score"),
                "rule_level": (assessment or {}).get("risk_level"),
                "indicators": indicators,
                "evidence_ids": retrieval_output["evidence_ids"],
            }
            reply = llm.chat_json(
                _SYSTEM_PROMPT,
                f"Assessment:\n{json.dumps(review_context, default=str)}",
                agent_name=AGENT_NAME,
            )
            ai_review = {
                "summary": str(reply.get("summary") or "").strip(),
                "key_concerns": reply.get("key_concerns")
                if isinstance(reply.get("key_concerns"), list)
                else [],
                "recommended_actions": reply.get("recommended_actions")
                if isinstance(reply.get("recommended_actions"), list)
                else [],
                "suggested_level": str(reply.get("suggested_level") or "").strip().upper(),
                "model": llm.model_for(AGENT_NAME),
            }
        except Exception as exc:
            warnings.append(f"AI risk review unavailable; used rule-based assessment ({exc}).")

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
            "ai_review": ai_review,
        },
        evidence_ids=retrieval_output["evidence_ids"],
        warnings=warnings,
    )
    log_run(
        db, AGENT_NAME, input_data=input_data, output=output, started_at=started, query_id=query_id
    )
    return output, assessment


def investigate(
    db: Session, transaction_id: str, query_id: str | None = None
) -> dict[str, Any] | None:
    """Retrieval Agent → Risk Agent. None when the transaction has no ledger record."""
    retrieval, evaluation = retrieval_agent.run(db, transaction_id, query_id=query_id)
    if evaluation is None:
        return None
    risk, assessment = run(db, retrieval, evaluation, query_id=query_id)
    return {"assessment": assessment, "agents": [retrieval, risk]}
