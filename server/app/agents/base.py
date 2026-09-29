"""Shared agent output contract and agent_runs logging."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.risk_assessment import AgentRun

logger = logging.getLogger(__name__)


def agent_output(
    agent_name: str,
    *,
    status: str,
    confidence_score: float,
    findings: dict[str, Any],
    evidence_ids: list[str],
    warnings: list[str],
) -> dict[str, Any]:
    return {
        "agent_name": agent_name,
        "status": status,
        "confidence_score": round(confidence_score, 2),
        "findings": findings,
        "evidence_ids": evidence_ids,
        "warnings": warnings,
    }


def _json(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def log_run(
    db: Session,
    agent_name: str,
    *,
    input_data: dict[str, Any],
    output: dict[str, Any] | None,
    started_at: datetime,
    error: str | None = None,
) -> int | None:
    """Store one agent execution. Logging must never break the investigation itself."""
    try:
        run = AgentRun(
            agent_name=agent_name,
            input_data=_json(input_data),
            output_data=_json(output) if output is not None else None,
            status="FAILED" if error else (output or {}).get("status", "COMPLETED"),
            confidence_score=Decimal(str((output or {}).get("confidence_score", 0))),
            started_at=started_at,
            completed_at=datetime.now(),
            error_message=error,
        )
        db.add(run)
        db.commit()
        return run.agent_run_id
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        logger.warning("Could not log agent run for %s: %s", agent_name, exc)
        return None
