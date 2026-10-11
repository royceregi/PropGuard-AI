"""Orchestrator Agent Pipeline (Phase 6 / Phase 9a).

Runs the 4-agent investigation pipeline in order:
1. Retrieval Agent (blockchain_retrieval_agent)
2. Transaction Analysis Agent (transaction_analysis_agent)
3. Risk Agent (risk_detection_agent)
4. Report Agent (report_agent)

Links outputs and logs under an optional investigation query_id.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents import (
    report_agent,
    retrieval_agent,
    risk_agent,
    transaction_analysis_agent,
)
from app.models.retrieval import QueryLog, QueryRetrieval
from app.models.risk_assessment import AgentRun

AGENT_NAME = "orchestrator"
QUERY_PREFIX = "investigate:"


def _open_investigation(db: Session, *, qid: str, tid: str, user_id: str | None) -> QueryLog | None:
    """Parent query_logs row, written before any agent runs: core.agent_runs.query_id has a
    foreign key to it. None when it cannot be written (agent runs are then left unlinked)."""
    log = QueryLog(
        query_id=qid,
        user_id=user_id,
        query_text=f"{QUERY_PREFIX}{tid}",
        log_timestamp=datetime.now(),
        agent_response="Investigation in progress.",
        confidence_score=0,
        relevance_score=0,
        flagged_suspicious=False,
        agent_used=AGENT_NAME,
    )
    try:
        db.add(log)
        db.commit()
        return log
    except Exception:
        db.rollback()
        return None


def _close_not_found(db: Session, log: QueryLog | None, tid: str, elapsed_ms: int) -> None:
    if log is None:
        return
    try:
        log.agent_response = f"No blockchain ledger record found for transaction {tid}."
        log.response_time_ms = elapsed_ms
        db.commit()
    except Exception:
        db.rollback()


def _log_investigation(
    db: Session,
    log: QueryLog | None,
    *,
    tid: str,
    assessment: dict[str, Any] | None,
    report: dict[str, Any],
    report_out: dict[str, Any],
    elapsed_ms: int,
) -> None:
    """Fill in the parent row and add one query_retrievals row per distinct evidence record.
    Logging must never break the investigation itself."""
    if log is None:
        return
    qid = log.query_id
    try:
        log.agent_response = (
            report.get("executive_summary")
            or f"Investigation report generated for transaction {tid}."
        )
        log.confidence_score = round(float(report_out.get("confidence_score", 1.0)), 4)
        log.relevance_score = round(float((assessment or {}).get("risk_score") or 0.0), 4)
        log.flagged_suspicious = (assessment or {}).get("risk_level") in ("HIGH", "MEDIUM")
        log.response_time_ms = elapsed_ms

        seen: set[tuple[str | None, int | None]] = set()
        for ev_id in sorted(report_out.get("evidence_ids", [])):
            table, _, rec_id = ev_id.partition(":")
            key = (
                tid if table in ("property_transactions", "blockchain_transactions") else None,
                int(rec_id) if table == "property_documents" and rec_id.isdigit() else None,
            )
            if key == (None, None) or key in seen:
                continue
            seen.add(key)
            db.add(
                QueryRetrieval(
                    query_id=qid,
                    transaction_id=key[0],
                    document_id=key[1],
                    rank=len(seen),
                    relevance_score=1.0,
                )
            )
        db.commit()
    except Exception:
        db.rollback()


def stored_report(db: Session, query_id: str) -> dict[str, Any] | None:
    """Report produced by the Report Agent for this investigation, read from agent_runs."""
    run = (
        db.query(AgentRun)
        .filter(AgentRun.query_id == query_id, AgentRun.agent_name == report_agent.AGENT_NAME)
        .order_by(AgentRun.agent_run_id.desc())
        .first()
    )
    output = (run.output_data or {}) if run else {}
    return (output.get("findings") or {}).get("report")


def reported_investigation_ids(db: Session, query_ids: list[str]) -> set[str]:
    """Which of these investigation IDs produced a report (i.e. were not NOT_FOUND)."""
    if not query_ids:
        return set()
    rows = (
        db.query(AgentRun.query_id)
        .filter(
            AgentRun.query_id.in_(query_ids),
            AgentRun.agent_name == report_agent.AGENT_NAME,
        )
        .distinct()
        .all()
    )
    return {qid for (qid,) in rows}


def investigate(
    db: Session,
    transaction_id: str,
    user_id: str | None = None,
    query_id: str | None = None,
) -> dict[str, Any] | None:
    """Run full 4-agent investigation pipeline for a transaction.

    Returns dict with keys: assessment, report, agents, query_id.
    Returns None if no transaction/ledger data is found.
    """
    started_ms = time.monotonic()
    tid = transaction_id.strip()
    qid = query_id or f"INV-{uuid.uuid4().hex[:8].upper()}"
    log = _open_investigation(db, qid=qid, tid=tid, user_id=user_id)
    run_qid = qid if log is not None else None

    # Step 1: Retrieval Agent
    retrieval_out, evaluation = retrieval_agent.run(db, tid, query_id=run_qid)
    if evaluation is None and retrieval_out.get("status") == "NOT_FOUND":
        _close_not_found(db, log, tid, int((time.monotonic() - started_ms) * 1000))
        return None

    # Step 2: Transaction Analysis Agent
    analysis_out, _ = transaction_analysis_agent.run(
        db, tid, retrieval_output=retrieval_out, evaluation=evaluation, query_id=run_qid
    )

    # Step 3: Risk Agent
    risk_out, assessment = risk_agent.run(db, retrieval_out, evaluation or {}, query_id=run_qid)

    # Step 4: Report Agent
    report_out, report = report_agent.run(
        db, retrieval_out, analysis_out, risk_out, assessment, query_id=run_qid
    )

    elapsed_ms = int((time.monotonic() - started_ms) * 1000)
    _log_investigation(
        db,
        log,
        tid=tid,
        assessment=assessment,
        report=report,
        report_out=report_out,
        elapsed_ms=elapsed_ms,
    )

    agents_list = [retrieval_out, analysis_out, risk_out, report_out]

    return {
        "query_id": qid,
        "transaction_id": tid,
        "assessment": assessment,
        "report": report,
        "agents": agents_list,
    }
