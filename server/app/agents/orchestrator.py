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

    # Step 1: Retrieval Agent
    retrieval_out, evaluation = retrieval_agent.run(db, tid)
    if evaluation is None and retrieval_out.get("status") == "NOT_FOUND":
        return None

    # Step 2: Transaction Analysis Agent
    analysis_out, _ = transaction_analysis_agent.run(
        db, tid, retrieval_output=retrieval_out, evaluation=evaluation
    )

    # Step 3: Risk Agent
    risk_out, assessment = risk_agent.run(db, retrieval_out, evaluation or {})

    # Step 4: Report Agent
    report_out, report = report_agent.run(db, retrieval_out, analysis_out, risk_out, assessment)

    elapsed_ms = int((time.monotonic() - started_ms) * 1000)

    # Log query if user_id or query_id provided
    if user_id:
        try:
            suspicious = (assessment or {}).get("risk_level") in ("HIGH", "MEDIUM")
            best_rel = float((assessment or {}).get("risk_score") or 0.0)
            log = QueryLog(
                query_id=qid,
                user_id=user_id,
                query_text=f"investigate:{tid}",
                log_timestamp=datetime.now(),
                agent_response=f"Investigation report generated for transaction {tid}.",
                confidence_score=round(float(report_out.get("confidence_score", 1.0)), 4),
                relevance_score=round(best_rel, 4),
                flagged_suspicious=suspicious,
                agent_used="orchestrator",
                response_time_ms=elapsed_ms,
            )
            db.add(log)

            for rank, ev_id in enumerate(report_out.get("evidence_ids", []), start=1):
                parts = ev_id.split(":")
                tbl = parts[0]
                rec_id = parts[1] if len(parts) > 1 else None
                db.add(
                    QueryRetrieval(
                        query_id=qid,
                        transaction_id=tid
                        if tbl in ("property_transactions", "blockchain_transactions")
                        else None,
                        document_id=int(rec_id)
                        if tbl == "property_documents" and rec_id and rec_id.isdigit()
                        else None,
                        rank=rank,
                        relevance_score=1.0,
                    )
                )
            db.commit()
        except Exception:
            db.rollback()

    agents_list = [retrieval_out, analysis_out, risk_out, report_out]

    return {
        "query_id": qid,
        "transaction_id": tid,
        "assessment": assessment,
        "report": report,
        "agents": agents_list,
    }
