"""Phase 7 / Phase 9 — Investigation Pipeline & Report Endpoints.

POST /api/v1/investigations/{transaction_id} — Run 4-agent investigation and generate report.
GET  /api/v1/investigations/query/{query_id} — Fetch stored investigation report by query_id.
GET  /api/v1/investigations/agent-runs — Audit trail of agent executions (SYSTEM / REGISTRY).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.agents import orchestrator
from app.api.deps import require_roles
from app.api.property_access import ensure_transaction_access
from app.core.database import get_db
from app.models.retrieval import QueryLog, QueryRetrieval
from app.models.risk_assessment import AgentRun
from app.models.user import User as UserModel

router = APIRouter()

INVESTIGATION_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
ADMIN_ROLES = ["SYSTEM", "REGISTRY"]


@router.post("/{transaction_id}")
def run_investigation(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(INVESTIGATION_ROLES)),
) -> dict[str, Any]:
    """Run full 4-agent investigation pipeline (Retrieval -> Analysis -> Risk -> Report)."""
    ensure_transaction_access(db, current_user, transaction_id)
    result = orchestrator.investigate(db, transaction_id.strip(), user_id=current_user.user_id)
    if result is None:
        raise HTTPException(
            status_code=404, detail="No blockchain or property record for this transaction"
        )
    return {
        "query_id": result["query_id"],
        "transaction_id": result["transaction_id"],
        "assessment": result["assessment"],
        "report": result["report"],
        "agents": result["agents"],
        "notice": "This is a risk indicator for investigation, not a legal fraud judgment.",
    }


@router.get("/query/{query_id}")
def get_investigation_by_query_id(
    query_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(INVESTIGATION_ROLES)),
) -> dict[str, Any]:
    """Fetch stored investigation record and agent runs by query_id."""
    log = db.query(QueryLog).filter(QueryLog.query_id == query_id.strip()).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Investigation record not found")

    runs = (
        db.query(AgentRun)
        .filter(AgentRun.query_id == query_id.strip())
        .order_by(AgentRun.started_at.asc())
        .all()
    )

    retrievals = (
        db.query(QueryRetrieval)
        .filter(QueryRetrieval.query_id == query_id.strip())
        .order_by(QueryRetrieval.rank.asc())
        .all()
    )

    return {
        "query_id": log.query_id,
        "query_text": log.query_text,
        "agent_used": log.agent_used,
        "confidence_score": float(log.confidence_score)
        if log.confidence_score is not None
        else None,
        "relevance_score": float(log.relevance_score) if log.relevance_score is not None else None,
        "flagged_suspicious": log.flagged_suspicious,
        "response_time_ms": log.response_time_ms,
        "agent_response": log.agent_response,
        "log_timestamp": log.log_timestamp.isoformat() if log.log_timestamp else None,
        "agent_runs": [
            {
                "agent_run_id": r.agent_run_id,
                "agent_name": r.agent_name,
                "status": r.status,
                "confidence_score": float(r.confidence_score)
                if r.confidence_score is not None
                else 0.0,
                "input_data": r.input_data,
                "output_data": r.output_data,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in runs
        ],
        "evidence": [
            {
                "transaction_id": r.transaction_id,
                "document_id": r.document_id,
                "rank": r.rank,
                "relevance_score": float(r.relevance_score)
                if r.relevance_score is not None
                else 0.0,
            }
            for r in retrievals
        ],
    }


@router.get("/agent-runs", response_model=list[dict[str, Any]])
def list_agent_runs(
    limit: int = Query(50, ge=1, le=200),
    agent_name: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    """Audit trail of agent executions for Super Admin and Land Registry."""
    query = db.query(AgentRun)
    if agent_name:
        query = query.filter(AgentRun.agent_name == agent_name.strip())
    runs = query.order_by(AgentRun.agent_run_id.desc()).limit(limit).all()
    return [
        {
            "agent_run_id": r.agent_run_id,
            "query_id": r.query_id,
            "agent_name": r.agent_name,
            "status": r.status,
            "confidence_score": float(r.confidence_score)
            if r.confidence_score is not None
            else 0.0,
            "error_message": r.error_message,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]
