"""Phase 5 — Information Retrieval API (07-information-retrieval.md).

GET  /api/v1/retrieval/search            — ranked evidence for a natural-language or structured query.
GET  /api/v1/retrieval/query/{query_id}  — detailed evidence view of a past retrieval or
                                           AI-assistant query (owner only for PUBLIC).
GET  /api/v1/retrieval/history           — recent queries for the dashboard (admin / registry / company).

Every query is logged in core.query_logs; evidence records go into core.query_retrievals.
"""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.property_access import is_public_viewer
from app.core.database import get_db
from app.models.retrieval import QueryLog, QueryRetrieval
from app.models.user import User as UserModel
from app.schemas.retrieval import RetrievalHit, RetrievalResponse
from app.services import query_guard, retrieval_service, user_assistant_service

router = APIRouter()

ALL_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
AUTHORITY_ROLES = ["SYSTEM", "REGISTRY", "COMPANY"]
MAX_LIMIT = 50
IR_AGENT = "IR-Agent"
_SUSPICIOUS_INTENTS = retrieval_service.SUSPICIOUS_INTENTS
_ORIGINS = {IR_AGENT: "retrieval", user_assistant_service.AGENT_NAME: "assistant"}


def _guarded_search(
    db: Session,
    user: UserModel,
    q: str,
    *,
    sources: list[str] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 20,
) -> tuple[dict, str | None]:
    """(search result, restricted message). Same access rules as the AI assistant."""
    guard = query_guard.guard_query(db, user, q)
    if guard.unauthorized:
        message = guard.restricted_message
        return {
            "interpreted": guard.parsed.to_dict(),
            "sources": sources or list(retrieval_service.SOURCES),
            "hits": [],
            "counts": {},
            "warnings": [message],
        }, message
    result = retrieval_service.search(
        db,
        q,
        sources=sources,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        property_scope=guard.property_scope,
    )
    return result, None


def _log(
    db: Session,
    *,
    query_id: str,
    user_id: str,
    query_text: str,
    hits: list[dict],
    result: dict,
    started_ms: float,
) -> None:
    """Persist the query log and one query_retrievals row per evidence record.
    Logging must never break the search response."""
    try:
        suspicious = bool(
            result["interpreted"].get("intents")
            and set(result["interpreted"]["intents"]) & _SUSPICIOUS_INTENTS
        )
        best_rel = max((h["relevance_score"] for h in hits), default=0.0)
        elapsed = int((time.monotonic() - started_ms) * 1000)
        log = QueryLog(
            query_id=query_id,
            user_id=user_id,
            query_text=query_text,
            log_timestamp=datetime.now(),
            agent_response=f"Retrieved {len(hits)} evidence record(s).",
            confidence_score=round(best_rel, 4),
            relevance_score=round(best_rel, 4),
            flagged_suspicious=suspicious,
            agent_used=IR_AGENT,
            response_time_ms=elapsed,
        )
        db.add(log)
        db.flush()

        for hit in hits:
            db.add(
                QueryRetrieval(
                    query_id=query_id,
                    transaction_id=hit.get("transaction_id"),
                    document_id=hit.get("document_id"),
                    rank=hit["rank"],
                    relevance_score=round(hit["relevance_score"], 4),
                )
            )
        db.commit()
    except Exception:
        db.rollback()


@router.get("/search", response_model=RetrievalResponse)
def search(
    q: str = Query(
        ..., min_length=1, max_length=1000, description="Natural-language or identifier query"
    ),
    sources: str | None = Query(None, description="Comma-separated: property,transaction,document"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(ALL_ROLES)),
):
    """
    Ranked evidence for one natural-language or structured query.

    PUBLIC users are restricted to their own or shared properties, and identifiers they
    cannot access are refused. Authority users (SYSTEM, REGISTRY, COMPANY) see all records.
    """
    source_list = [s.strip().lower() for s in (sources or "").split(",") if s.strip()] or None

    started = time.monotonic()
    query_id = f"QRY{uuid.uuid4().hex[:8].upper()}"

    result, restricted = _guarded_search(
        db,
        current_user,
        q,
        sources=source_list,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )

    elapsed = int((time.monotonic() - started) * 1000)
    hits = result["hits"]
    _log(
        db,
        query_id=query_id,
        user_id=current_user.user_id,
        query_text=q,
        hits=hits,
        result=result,
        started_ms=started,
    )

    ai_answer = restricted or retrieval_service.synthesize_retrieval_answer(q, result)

    return RetrievalResponse(
        query_id=query_id,
        interpreted=result["interpreted"],
        sources=result["sources"],
        hits=[RetrievalHit(**h) for h in hits],
        counts=result["counts"],
        warnings=result["warnings"],
        response_time_ms=elapsed,
        ai_answer=ai_answer,
        question=q,
        origin="retrieval",
    )


@router.get("/query/{query_id}", response_model=RetrievalResponse)
def query_detail(
    query_id: str,
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(ALL_ROLES)),
):
    """
    Detailed evidence for a past Evidence Retrieval or AI-assistant query.

    The stored question is searched again under the caller's current access scope, and the
    stored answer is returned as ``ai_answer`` so the page matches what the chat showed.
    """
    log = db.query(QueryLog).filter(QueryLog.query_id == query_id.strip()).first()
    if (
        log is None
        or log.agent_used not in _ORIGINS
        or (is_public_viewer(current_user) and log.user_id != current_user.user_id)
    ):
        raise HTTPException(status_code=404, detail="Query not found")

    question = log.query_text or ""
    started = time.monotonic()
    result, restricted = _guarded_search(db, current_user, question, limit=limit)
    elapsed = int((time.monotonic() - started) * 1000)

    return RetrievalResponse(
        query_id=log.query_id,
        interpreted=result["interpreted"],
        sources=result["sources"],
        hits=[RetrievalHit(**h) for h in result["hits"]],
        counts=result["counts"],
        warnings=result["warnings"],
        response_time_ms=elapsed,
        ai_answer=restricted or log.agent_response,
        question=question,
        origin=_ORIGINS[log.agent_used],
    )


@router.get("/history", response_model=list[dict])
def recent_queries(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(AUTHORITY_ROLES)),
):
    """Recent IR-Agent queries for the analytics dashboard. Authority roles only."""
    rows = (
        db.query(
            QueryLog.query_id,
            QueryLog.user_id,
            QueryLog.query_text,
            QueryLog.log_timestamp,
            QueryLog.confidence_score,
            QueryLog.relevance_score,
            QueryLog.flagged_suspicious,
            QueryLog.response_time_ms,
        )
        .filter(QueryLog.agent_used == IR_AGENT)
        .order_by(QueryLog.log_timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "query_id": r.query_id,
            "user_id": r.user_id,
            "query_text": r.query_text,
            "log_timestamp": r.log_timestamp.isoformat() if r.log_timestamp else None,
            "confidence_score": float(r.confidence_score)
            if r.confidence_score is not None
            else None,
            "relevance_score": float(r.relevance_score) if r.relevance_score is not None else None,
            "flagged_suspicious": r.flagged_suspicious,
            "response_time_ms": r.response_time_ms,
        }
        for r in rows
    ]
