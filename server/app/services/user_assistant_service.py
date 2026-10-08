"""User NLP Property & Transaction Assistant Service.

Processes natural-language queries entered by users, leveraging evidence retrieval
and NLP synthesis. Scopes queries for PUBLIC users to their authorized records,
and maintains full interaction history in core.query_logs.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core import llm
from app.models.property import (
    Property,
    PropertyDocument,
    PropertyTransaction,
)
from app.models.retrieval import QueryLog, QueryRetrieval
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.user_assistant import (
    UserAssistantHistoryItem,
    UserAssistantQueryResponse,
    UserAssistantSource,
)
from app.services import retrieval_service

logger = logging.getLogger(__name__)

AGENT_NAME = "User-NLP-Assistant"

_PROP_ID_PATTERN = re.compile(r"\b\d{14,20}\b")
_DEED_PATTERN = re.compile(r"\bTD-[A-Z0-9-]+\b", re.IGNORECASE)


def _format_money(amount: Any) -> str:
    if amount is None:
        return "N/A"
    try:
        val = float(amount)
        return f"AED {val:,.2f}"
    except (ValueError, TypeError):
        return f"AED {amount}"


def _format_date(val: Any) -> str:
    if val is None:
        return "N/A"
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M")
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val)


def get_accessible_property_records(db: Session, user: UserModel) -> list[dict[str, Any]]:
    """Retrieve all properties, transactions, and documents directly accessible to this user."""
    accessible_ids = property_repository.accessible_property_ids_for_user(db, user.user_id)
    if not accessible_ids:
        # If user is authority (SYSTEM/REGISTRY/COMPANY) without direct owned properties,
        # sample up to 5 properties so context is available
        if user.access_level != "PUBLIC":
            accessible_ids = {r[0] for r in db.query(Property.property_id).limit(5).all() if r[0]}
        else:
            return []

    properties = db.query(Property).filter(Property.property_id.in_(accessible_ids)).all()

    records: list[dict[str, Any]] = []
    for prop in properties:
        transactions = (
            db.query(PropertyTransaction)
            .filter(PropertyTransaction.property_id == prop.property_id)
            .order_by(PropertyTransaction.transaction_datetime.desc().nullslast())
            .limit(5)
            .all()
        )
        documents = (
            db.query(PropertyDocument)
            .filter(PropertyDocument.property_id == prop.property_id)
            .limit(5)
            .all()
        )
        records.append(
            {
                "property": prop,
                "transactions": transactions,
                "documents": documents,
                "is_owner": prop.current_owner_id == user.user_id,
            }
        )

    return records


def process_user_query(
    db: Session,
    user: UserModel,
    question: str,
) -> UserAssistantQueryResponse:
    """Process a natural language question with evidence retrieval and history persistence."""
    started_ms = time.monotonic()
    query_id = f"NLP-{uuid.uuid4().hex[:8].upper()}"
    clean_q = question.strip()

    is_public = user.access_level == "PUBLIC"
    records = get_accessible_property_records(db, user)
    accessible_prop_ids = {r["property"].property_id for r in records}
    accessible_deed_numbers = {
        r["property"].title_deed_number.upper() for r in records if r["property"].title_deed_number
    }

    # 1. Scope restriction for PUBLIC users: prevent probing unauthorized property IDs
    if is_public and accessible_prop_ids:
        mentioned_props = set(_PROP_ID_PATTERN.findall(clean_q))
        unauthorized_props = mentioned_props - accessible_prop_ids
        mentioned_deeds = {d.upper() for d in _DEED_PATTERN.findall(clean_q)}
        unauthorized_deeds = mentioned_deeds - accessible_deed_numbers

        if unauthorized_props or unauthorized_deeds:
            culprits = list(unauthorized_props) + list(unauthorized_deeds)
            answer = (
                f"Access Restricted: You are authorized to query properties and transactions "
                f"associated with your account. The identifier '{', '.join(culprits)}' "
                f"is not linked to your registered or shared property records."
            )
            elapsed = int((time.monotonic() - started_ms) * 1000)
            _save_query_log(db, query_id, user.user_id, clean_q, answer, 0.0, elapsed, False)
            return UserAssistantQueryResponse(
                query_id=query_id,
                question=clean_q,
                answer=answer,
                confidence_score=0.0,
                timestamp=datetime.now(),
                sources=[],
                scoped_properties_count=len(records),
                warnings=["Unauthorized property reference detected"],
            )

    # 2. Run Evidence Retrieval Engine over the question
    prop_scope = accessible_prop_ids if is_public and accessible_prop_ids else None
    search_res = retrieval_service.search(
        db,
        clean_q,
        limit=8,
        property_scope=prop_scope,
    )
    hits = search_res.get("hits", [])

    # 3. Compile sources & context
    sources: list[UserAssistantSource] = []
    seen_sources: set[str] = set()

    for h in hits:
        sid = f"{h['source']}:{h['record_id']}"
        if sid not in seen_sources:
            seen_sources.add(sid)
            sources.append(
                UserAssistantSource(
                    source_type=h["source"],
                    identifier=h["record_id"],
                    title=h["title"],
                    details=h.get("subtitle") or h.get("snippet"),
                )
            )

    for r in records[:3]:
        p = r["property"]
        sid = f"property:{p.property_id}"
        if sid not in seen_sources:
            seen_sources.add(sid)
            sources.append(
                UserAssistantSource(
                    source_type="property",
                    identifier=p.property_id,
                    title=p.property_name or f"Property {p.property_id}",
                    details=f"{p.district or 'Dubai'} - Deed: {p.title_deed_number or 'N/A'}",
                )
            )

    # 4. Generate Natural Language Answer
    answer = _synthesize_answer(clean_q, records, search_res)

    elapsed = int((time.monotonic() - started_ms) * 1000)
    _save_query_log(db, query_id, user.user_id, clean_q, answer, 0.95, elapsed, False, sources)

    return UserAssistantQueryResponse(
        query_id=query_id,
        question=clean_q,
        answer=answer,
        confidence_score=0.95,
        timestamp=datetime.now(),
        sources=sources[:5],
        scoped_properties_count=len(records),
        warnings=search_res.get("warnings", []),
    )


def _synthesize_answer(
    question: str,
    records: list[dict[str, Any]],
    search_res: dict[str, Any],
) -> str:
    """Generate intelligent natural language answer via LLM or deterministic NLP."""
    hits = search_res.get("hits", [])
    q_lower = question.lower()

    # If LLM is enabled, generate via LLM with context
    if llm.is_enabled():
        try:
            records_summary = []
            for r in records[:3]:
                p = r["property"]
                records_summary.append(
                    f"Owned/Shared Property: {p.property_id} ({p.property_name or 'N/A'}), "
                    f"Deed: {p.title_deed_number}, District: {p.district}, Area: {p.land_area} {p.area_unit}, "
                    f"Status: {p.legal_status}, Encumbrances: {p.encumbrances}"
                )
                for tx in r["transactions"][:2]:
                    records_summary.append(
                        f"  Tx {tx.transaction_id}: Date {tx.transaction_datetime}, Value: {_format_money(tx.transaction_value)}"
                    )

            for h in hits[:5]:
                records_summary.append(
                    f"Retrieved Evidence [{h['source']}]: {h['title']} ({h.get('subtitle') or ''}) "
                    f"Value: {_format_money(h.get('value')) if h.get('value') else 'N/A'}"
                )

            system_prompt = (
                "You are PropGuard AI's intelligent Property and Investigation Assistant. "
                "The user entered a natural language query or question in their thought. "
                "Provide a clear, direct, helpful, and natural conversational answer to what the user expects. "
                "Answer using the facts and retrieved evidence provided below. "
                "Cite exact numbers, dates, locations, or title deeds where appropriate. "
                "Keep the response professional, friendly, and structured (2-4 sentences or clear bullet points)."
            )
            user_msg = (
                f"User Question: {question}\n\n"
                f"Context and Retrieved Evidence:\n" + "\n".join(records_summary) + "\n\n"
                'Return a JSON object: {"answer": "Your direct natural language answer"}'
            )
            res = llm.chat_json(system_prompt, user_msg)
            if isinstance(res, dict) and res.get("answer"):
                return str(res["answer"])
        except Exception:
            pass

    # Deterministic NLP Engine
    # Case A: User asks about specific property attributes in their portfolio
    if records and any(
        k in q_lower for k in ["my property", "my villa", "my apartment", "my house"]
    ):
        p = records[0]["property"]
        txs = records[0]["transactions"]

        if any(k in q_lower for k in ["value", "worth", "price", "valuation"]):
            val = _format_money(txs[0].transaction_value) if txs else "Not recorded"
            return (
                f"Your property '{p.property_name or p.property_id}' located in {p.district or 'Dubai'} "
                f"has a latest recorded transaction value of {val}. "
                f"Total registered land area is {p.land_area or 'N/A'} {p.area_unit or 'SQ_METER'}."
            )

        if any(k in q_lower for k in ["title deed", "deed", "number"]):
            return (
                f"The official title deed number for your property '{p.property_name or p.property_id}' is "
                f"{p.title_deed_number or 'TD-DXB-RECORDED'}. "
                f"Survey plan number is {p.survey_plan_number or 'N/A'}."
            )

        if any(
            k in q_lower for k in ["encumbrance", "dispute", "mortgage", "restriction", "legal"]
        ):
            enc = p.encumbrances or "None reported"
            status = p.legal_status or "Clear"
            return (
                f"Legal status for '{p.property_name or p.property_id}' is currently '{status}'. "
                f"Encumbrance check status: '{enc}'."
            )

    # Case B: Evidence Retrieval Search Result Answering
    if hits:
        return retrieval_service.synthesize_retrieval_answer(question, search_res)

    # Case C: Fallback when no direct hits but user has records
    if records:
        p = records[0]["property"]
        return (
            f"Here is a summary of your property record '{p.property_name or p.property_id}': "
            f"Title Deed: {p.title_deed_number or 'N/A'}, District: {p.district or 'Dubai'}, "
            f"Land Area: {p.land_area or 'N/A'} {p.area_unit or 'sq m'}, Legal Status: {p.legal_status or 'Clear'}. "
            f"You can ask me specific questions about valuation, title deeds, transactions, or encumbrances."
        )

    return (
        f"No records matching '{question}' were found in the database. "
        "Try rephrasing your question or querying by district (e.g. 'Dubai Marina') or property ID."
    )


def _save_query_log(
    db: Session,
    query_id: str,
    user_id: str,
    question: str,
    answer: str,
    confidence: float,
    elapsed_ms: int,
    flagged: bool = False,
    sources: list[UserAssistantSource] | None = None,
) -> None:
    """Save user inquiry and response to core.query_logs and core.query_retrievals."""
    try:
        log = QueryLog(
            query_id=query_id,
            user_id=user_id,
            query_text=question,
            log_timestamp=datetime.now(),
            agent_response=answer,
            confidence_score=Decimal(str(round(confidence, 4))),
            relevance_score=Decimal("1.0"),
            flagged_suspicious=flagged,
            agent_used=AGENT_NAME,
            response_time_ms=elapsed_ms,
        )
        db.add(log)
        db.flush()

        if sources:
            for rank, s in enumerate(sources[:10], start=1):
                tx_id = s.identifier if s.source_type == "transaction" else None
                doc_id = (
                    int(s.identifier)
                    if s.source_type == "document" and s.identifier.isdigit()
                    else None
                )
                db.add(
                    QueryRetrieval(
                        query_id=query_id,
                        transaction_id=tx_id,
                        document_id=doc_id,
                        rank=rank,
                        relevance_score=Decimal("1.0"),
                    )
                )
        db.commit()
    except Exception as exc:
        logger.warning("Failed to save query log for user assistant: %s", exc)
        db.rollback()


def get_user_history(db: Session, user_id: str, limit: int = 30) -> list[UserAssistantHistoryItem]:
    """Retrieve saved NLP assistant questions and answers for this user."""
    logs = (
        db.query(QueryLog)
        .filter(
            QueryLog.user_id == user_id,
            QueryLog.agent_used == AGENT_NAME,
        )
        .order_by(desc(QueryLog.log_timestamp))
        .limit(limit)
        .all()
    )

    items: list[UserAssistantHistoryItem] = []
    for log in logs:
        retrievals = (
            db.query(QueryRetrieval)
            .filter(QueryRetrieval.query_id == log.query_id)
            .order_by(QueryRetrieval.rank.asc())
            .all()
        )
        sources: list[UserAssistantSource] = []
        for ret in retrievals:
            if ret.transaction_id:
                sources.append(
                    UserAssistantSource(
                        source_type="transaction",
                        identifier=ret.transaction_id,
                        title=f"Transaction {ret.transaction_id}",
                    )
                )
            elif ret.document_id:
                sources.append(
                    UserAssistantSource(
                        source_type="document",
                        identifier=str(ret.document_id),
                        title=f"Document {ret.document_id}",
                    )
                )

        items.append(
            UserAssistantHistoryItem(
                query_id=log.query_id,
                question=log.query_text or "",
                answer=log.agent_response or "",
                confidence_score=float(log.confidence_score)
                if log.confidence_score is not None
                else None,
                timestamp=log.log_timestamp or datetime.now(),
                sources=sources,
            )
        )

    return items


def clear_user_history(db: Session, user_id: str) -> int:
    """Clear NLP assistant history for this user."""
    logs = (
        db.query(QueryLog)
        .filter(
            QueryLog.user_id == user_id,
            QueryLog.agent_used == AGENT_NAME,
        )
        .all()
    )
    count = len(logs)
    for log in logs:
        db.query(QueryRetrieval).filter(QueryRetrieval.query_id == log.query_id).delete(
            synchronize_session=False
        )
        db.delete(log)
    db.commit()
    return count
