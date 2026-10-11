"""User NLP Property & Transaction Assistant Service.

Single natural-language entry point for users. Routes each question to:
- retrieval mode: Evidence Retrieval search + NL synthesis (short answer in chat; the full
  ranked evidence for the same query_id is on the Evidence Retrieval page), or
- investigation mode: the 4-agent pipeline (Retrieval -> Transaction Analysis -> Risk -> Report)
  when the question asks about the risk / verification of a specific transaction.

PUBLIC users are scoped to their own and shared records via the shared query guard, and every
interaction is kept in core.query_logs.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.agents import orchestrator
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
    AssistantMode,
    UserAssistantHistoryItem,
    UserAssistantQueryResponse,
    UserAssistantSource,
)
from app.services import query_guard, retrieval_service
from app.services.retrieval_service import parse_query

logger = logging.getLogger(__name__)

AGENT_NAME = "User-NLP-Assistant"
QUERY_PREFIX = "NLP-"
RESTRICTED_PREFIX = "Access Restricted"
# Answer built only from the user's own property record (no ranked evidence hit).
RECORD_CONTEXT_CONFIDENCE = 0.5
MAX_CONTEXT_PROPERTIES = 10
FOLLOW_UP_TURNS = 3
FOLLOW_UP_WINDOW = timedelta(minutes=30)

CURRENT_OWNER = "current owner"
FORMER_OWNER = "former owner"
TRANSACTION_PARTY = "party to a transaction"
SHARED = "shared with the user"
REGISTRY_SAMPLE = "registry record, not linked to the user"
RELATIONSHIP_ORDER = [CURRENT_OWNER, FORMER_OWNER, TRANSACTION_PARTY, SHARED, REGISTRY_SAMPLE]

_INVESTIGATE_RE = re.compile(
    r"\b(?:risk\w*|verif\w*|fraud\w*|suspicious|investigat\w*|report|safe|tamper\w*"
    r"|integrity|legit\w*|authentic\w*|genuine)\b",
    re.IGNORECASE,
)
_SELF_RE = re.compile(r"\b(?:my|mine|i own|i have|our)\b", re.IGNORECASE)
_FOLLOW_UP_RE = re.compile(r"\b(?:it|its|this|that|same|above|previous|last one)\b", re.IGNORECASE)
_LISTING_RE = re.compile(r"\b(?:show|list|all|which|how many)\b", re.IGNORECASE)


def investigation_id_for(query_id: str) -> str:
    """The orchestrator investigation started from an assistant question shares its suffix."""
    return f"INV-{query_id.removeprefix(QUERY_PREFIX)}"


def retrieval_detail_url(query_id: str) -> str:
    return f"/property-search?tab=retrieval&qid={query_id}"


def investigation_detail_url(investigation_id: str) -> str:
    return f"/investigation-reports/{investigation_id}"


def wants_investigation(question: str, parsed: retrieval_service.ParsedQuery) -> bool:
    return bool(parsed.transaction_ids) and bool(_INVESTIGATE_RE.search(question))


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


def get_accessible_property_records(
    db: Session,
    user: UserModel,
    property_scope: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Retrieve all properties, transactions, and documents directly accessible to this user.

    ``property_scope`` is the guard's scope (None = authority). Authority users get their own
    properties, or a small sample so the LLM has context.
    """
    is_sample = False
    if property_scope is not None:
        accessible_ids = property_scope
    else:
        accessible_ids = property_repository.accessible_property_ids_for_user(db, user.user_id)
        if not accessible_ids:
            is_sample = True
            accessible_ids = {r[0] for r in db.query(Property.property_id).limit(5).all() if r[0]}
    if not accessible_ids:
        return []

    _, history_ids, party_ids = property_repository.property_access_sets(db, user.user_id)
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
        is_owner = prop.current_owner_id == user.user_id
        if is_owner:
            relationship = CURRENT_OWNER
        elif is_sample:
            relationship = REGISTRY_SAMPLE
        elif prop.property_id in history_ids:
            relationship = FORMER_OWNER
        elif prop.property_id in party_ids:
            relationship = TRANSACTION_PARTY
        else:
            relationship = SHARED
        records.append(
            {
                "property": prop,
                "transactions": transactions,
                "documents": documents,
                "is_owner": is_owner,
                "relationship": relationship,
            }
        )

    records.sort(key=lambda r: RELATIONSHIP_ORDER.index(r["relationship"]))
    return records


def process_user_query(
    db: Session,
    user: UserModel,
    question: str,
) -> UserAssistantQueryResponse:
    """Route a natural-language question to retrieval or investigation, and log it."""
    started_ms = time.monotonic()
    query_id = f"{QUERY_PREFIX}{uuid.uuid4().hex[:8].upper()}"
    clean_q = question.strip()

    guard = query_guard.guard_query(db, user, clean_q)
    records = get_accessible_property_records(db, user, guard.property_scope)

    # 1. Refuse questions about records outside the user's scope.
    if guard.unauthorized:
        answer = guard.restricted_message
        elapsed = int((time.monotonic() - started_ms) * 1000)
        _save_query_log(db, query_id, user.user_id, clean_q, answer, 0.0, elapsed, flagged=True)
        return UserAssistantQueryResponse(
            query_id=query_id,
            question=clean_q,
            answer=answer,
            confidence_score=0.0,
            timestamp=datetime.now(),
            sources=[],
            scoped_properties_count=len(records),
            warnings=["Unauthorized property reference detected"],
            mode="restricted",
        )

    turns = _recent_turns(db, user.user_id)

    # 2. Risk / verification question about a transaction -> 4-agent investigation.
    #    The transaction is named in the question, or resolved from the user's records
    #    or the previous turn ("is it risky?").
    pre_warnings: list[str] = []
    target_tx: str | None = None
    if wants_investigation(clean_q, guard.parsed):
        target_tx = guard.parsed.transaction_ids[0]
    elif _INVESTIGATE_RE.search(clean_q):
        target_tx, clarification = _implicit_transaction(
            db, user, clean_q, guard.parsed, records, guard.property_scope, turns
        )
        if clarification:
            return _record_answer(db, user, query_id, clean_q, clarification, records, started_ms)
    if target_tx:
        response = _answer_with_investigation(
            db, user, query_id, clean_q, target_tx, records, started_ms
        )
        if response is not None:
            return response
        pre_warnings.append(
            f"No blockchain ledger record found for {target_tx}; "
            "showing registry evidence instead of a full investigation."
        )

    # 3. Evidence Retrieval over the question (same engine as the Evidence Retrieval page).
    search_res = retrieval_service.search(
        db,
        clean_q,
        limit=8,
        property_scope=guard.property_scope,
    )
    hits = search_res.get("hits", [])

    # 4. Compile sources & context
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
            sources.append(_property_source(p))

    # 5. Generate Natural Language Answer
    answer = _synthesize_answer(clean_q, records, search_res, turns)
    confidence = max(
        (h["relevance_score"] for h in hits),
        default=RECORD_CONTEXT_CONFIDENCE if records else 0.0,
    )
    flagged = bool(set(guard.parsed.intents) & retrieval_service.SUSPICIOUS_INTENTS)

    elapsed = int((time.monotonic() - started_ms) * 1000)
    _save_query_log(
        db,
        query_id,
        user.user_id,
        clean_q,
        answer,
        confidence,
        elapsed,
        flagged=flagged,
        evidence=_evidence_rows(hits),
    )

    # Search-tuning warnings ("no record matched every term") belong on the Evidence
    # Retrieval page, not in a chat answer.
    return UserAssistantQueryResponse(
        query_id=query_id,
        question=clean_q,
        answer=answer,
        confidence_score=round(confidence, 4),
        timestamp=datetime.now(),
        sources=sources[:5],
        scoped_properties_count=len(records),
        warnings=pre_warnings,
        mode="retrieval",
        detail_url=retrieval_detail_url(query_id),
    )


def _property_source(p: Property) -> UserAssistantSource:
    return UserAssistantSource(
        source_type="property",
        identifier=p.property_id,
        title=p.property_name or f"Property {p.property_id}",
        details=f"{p.district or 'Dubai'} - Deed: {p.title_deed_number or 'N/A'}",
    )


def _record_answer(
    db: Session,
    user: UserModel,
    query_id: str,
    question: str,
    answer: str,
    records: list[dict[str, Any]],
    started_ms: float,
) -> UserAssistantQueryResponse:
    """Answer built from the user's own records only (no evidence search)."""
    elapsed = int((time.monotonic() - started_ms) * 1000)
    _save_query_log(
        db, query_id, user.user_id, question, answer, RECORD_CONTEXT_CONFIDENCE, elapsed
    )
    return UserAssistantQueryResponse(
        query_id=query_id,
        question=question,
        answer=answer,
        confidence_score=RECORD_CONTEXT_CONFIDENCE,
        timestamp=datetime.now(),
        sources=[_property_source(r["property"]) for r in records[:5]],
        scoped_properties_count=len(records),
        mode="retrieval",
        detail_url=retrieval_detail_url(query_id),
    )


def _recent_turns(db: Session, user_id: str) -> list[tuple[str, str]]:
    """Recent (question, answer) pairs, oldest first, so follow-ups keep their context."""
    since = datetime.now() - FOLLOW_UP_WINDOW
    try:
        logs = (
            db.query(QueryLog)
            .filter(
                QueryLog.user_id == user_id,
                QueryLog.agent_used == AGENT_NAME,
                QueryLog.log_timestamp >= since,
            )
            .order_by(desc(QueryLog.log_timestamp))
            .limit(FOLLOW_UP_TURNS)
            .all()
        )
    except Exception as exc:
        logger.warning("Could not load assistant conversation context: %s", exc)
        db.rollback()
        return []
    return [
        (log.query_text or "", log.agent_response or "")
        for log in reversed(list(logs))
        if not (log.agent_response or "").startswith(RESTRICTED_PREFIX)
    ]


def _latest_transaction_id(db: Session, property_id: str) -> str | None:
    row = (
        db.query(PropertyTransaction.transaction_id)
        .filter(PropertyTransaction.property_id == property_id)
        .order_by(PropertyTransaction.transaction_datetime.desc().nullslast())
        .first()
    )
    return row[0] if row else None


def _implicit_transaction(
    db: Session,
    user: UserModel,
    question: str,
    parsed: retrieval_service.ParsedQuery,
    records: list[dict[str, Any]],
    property_scope: set[str] | None,
    turns: list[tuple[str, str]],
) -> tuple[str | None, str | None]:
    """(transaction to investigate, clarification) for a risk question naming no transaction."""
    if parsed.property_ids:
        return _latest_transaction_id(db, parsed.property_ids[0]), None

    if turns and _FOLLOW_UP_RE.search(question):
        last_question, last_answer = turns[-1]
        for tid in parse_query(f"{last_question} {last_answer}").transaction_ids:
            if property_scope is None or property_repository.user_can_access_transaction(
                db, user.user_id, tid
            ):
                return tid, None

    # Authority users have no portfolio of their own to pick from.
    if property_scope is None or _LISTING_RE.search(question):
        return None, None

    candidates = [r for r in records if r["transactions"]]
    q_lower = question.lower()
    named = [
        r
        for r in candidates
        if any(
            value and str(value).lower() in q_lower
            for value in (r["property"].property_name, r["property"].district)
        )
    ]
    if named:
        candidates = named
    elif not _SELF_RE.search(question):
        return None, None
    else:
        owned_now = [r for r in candidates if r["is_owner"]]
        if len(owned_now) == 1:
            candidates = owned_now

    if len(candidates) == 1:
        return candidates[0]["transactions"][0].transaction_id, None
    if not candidates:
        return None, None

    lines = [
        f"You have {len(candidates)} properties with recorded transactions. "
        "Which one should I investigate?"
    ]
    for r in candidates[:MAX_CONTEXT_PROPERTIES]:
        p = r["property"]
        tx = r["transactions"][0]
        lines.append(
            f"- {p.property_name or p.property_id} ({p.district or 'Dubai'}): latest transaction "
            f"{tx.transaction_id} on {_format_date(tx.transaction_datetime)}"
        )
    example = candidates[0]["transactions"][0].transaction_id
    lines.append(f'Ask for example: "Is transaction {example} risky?"')
    return None, "\n".join(lines)


def _answer_with_investigation(
    db: Session,
    user: UserModel,
    query_id: str,
    question: str,
    transaction_id: str,
    records: list[dict[str, Any]],
    started_ms: float,
) -> UserAssistantQueryResponse | None:
    """Run the 4-agent pipeline; None when the transaction has no ledger record."""
    investigation_id = investigation_id_for(query_id)
    try:
        inv = orchestrator.investigate(
            db, transaction_id, user_id=user.user_id, query_id=investigation_id
        )
    except Exception as exc:
        logger.warning("Assistant investigation failed for %s: %s", transaction_id, exc)
        return None
    if inv is None:
        return None

    report = inv.get("report") or {}
    risk = report.get("risk_summary") or {}
    risk_level = str(risk.get("risk_level") or "UNKNOWN")
    risk_score = float(risk.get("risk_score") or 0.0)
    answer = (
        f"Investigation of transaction {transaction_id}: {risk_level} risk "
        f"(score {risk_score:.2f}).\n"
        f"{report.get('executive_summary') or ''}\n"
        f"Recommendation: {report.get('recommendation') or 'N/A'}"
    ).strip()
    report_agent_out = (inv.get("agents") or [{}])[-1]
    confidence = float(report_agent_out.get("confidence_score") or 0.0)
    warnings = list(report_agent_out.get("warnings") or [])
    notice = report.get("responsible_ai_notice")

    sources = [
        UserAssistantSource(
            source_type="transaction",
            identifier=transaction_id,
            title=f"Transaction {transaction_id}",
            details=f"Risk level: {risk_level}",
        )
    ]
    if report.get("property_id"):
        sources.append(
            UserAssistantSource(
                source_type="property",
                identifier=str(report["property_id"]),
                title=f"Property {report['property_id']}",
            )
        )

    elapsed = int((time.monotonic() - started_ms) * 1000)
    _save_query_log(
        db,
        query_id,
        user.user_id,
        question,
        answer,
        confidence,
        elapsed,
        flagged=risk_level in ("HIGH", "MEDIUM"),
        evidence=[(transaction_id, None, 1.0)],
    )

    return UserAssistantQueryResponse(
        query_id=query_id,
        question=question,
        answer=answer,
        confidence_score=round(confidence, 4),
        timestamp=datetime.now(),
        sources=sources,
        scoped_properties_count=len(records),
        warnings=warnings + ([notice] if notice else []),
        mode="investigation",
        detail_url=investigation_detail_url(investigation_id),
        investigation_id=investigation_id,
        risk_level=risk_level,
    )


def _evidence_rows(hits: list[dict[str, Any]]) -> list[tuple[str | None, int | None, float]]:
    """(transaction_id, document_id, relevance) per ranked hit that query_retrievals can store."""
    rows: list[tuple[str | None, int | None, float]] = []
    seen: set[tuple[str | None, int | None]] = set()
    for h in hits:
        key: tuple[str | None, int | None]
        if h["source"] == "transaction" and h.get("transaction_id"):
            key = (str(h["transaction_id"]), None)
        elif h["source"] == "document" and h.get("document_id") is not None:
            key = (None, int(h["document_id"]))
        else:
            continue
        if key not in seen:
            seen.add(key)
            rows.append((key[0], key[1], float(h["relevance_score"])))
    return rows


def _property_context(records: list[dict[str, Any]]) -> list[str]:
    """Facts about the user's accessible properties, with their owned/shared role."""
    counts = {
        rel: sum(1 for r in records if r["relationship"] == rel) for rel in RELATIONSHIP_ORDER
    }
    lines = [
        f"Portfolio: {len(records)} accessible properties ("
        + ", ".join(f"{n} {rel}" for rel, n in counts.items() if n)
        + ")."
    ]
    for r in records[:MAX_CONTEXT_PROPERTIES]:
        p = r["property"]
        lines.append(
            f"Property {p.property_id} [user is {r['relationship'].upper()}]: name {p.property_name or 'N/A'}, "
            f"district {p.district or 'N/A'}, usage {p.current_usage_type or 'N/A'} "
            f"{p.current_subtype or ''}".rstrip()
            + f", area {p.land_area or 'N/A'} {p.area_unit or 'sq m'}, "
            f"current value {_format_money(p.current_value)}, title deed "
            f"{p.title_deed_number or 'N/A'}, legal status {p.legal_status or 'N/A'}, "
            f"verification {p.verification_status or 'N/A'}, "
            f"encumbrances {p.encumbrances or 'None'}"
        )
        for tx in r["transactions"][:3]:
            lines.append(
                f"  Transaction {tx.transaction_id}: {tx.procedure_name or 'transaction'} on "
                f"{_format_date(tx.transaction_datetime)}, value {_format_money(tx.transaction_value)}"
            )
        for doc in r["documents"][:3]:
            lines.append(
                f"  Document {doc.document_type or 'document'} {doc.document_number or ''}".rstrip()
                + f": issued {_format_date(doc.issued_date)}, "
                f"verification {doc.verification_status or 'N/A'}"
            )
    if len(records) > MAX_CONTEXT_PROPERTIES:
        lines.append(f"(and {len(records) - MAX_CONTEXT_PROPERTIES} more properties)")
    return lines


def _synthesize_answer(
    question: str,
    records: list[dict[str, Any]],
    search_res: dict[str, Any],
    turns: list[tuple[str, str]] | None = None,
) -> str:
    """Generate intelligent natural language answer via LLM or deterministic NLP."""
    hits = search_res.get("hits", [])

    if llm.is_enabled():
        try:
            context = _property_context(records) if records else ["No accessible properties."]
            for h in hits[:5]:
                context.append(
                    f"Retrieved evidence [{h['source']}] {h['title']} ({h.get('subtitle') or ''})"
                    + (f", value {_format_money(h['value'])}" if h.get("value") else "")
                )
            history = "\n".join(f"User: {q}\nAssistant: {a[:400]}" for q, a in turns or [])

            system_prompt = (
                "You are PropGuard AI, the property and investigation assistant of the Dubai "
                "land registry platform. Answer the user's question directly using ONLY the "
                "facts in the context. Rules:\n"
                "- Count and list properties from the Portfolio line. Each property states the "
                "user's relationship to it: CURRENT OWNER, FORMER OWNER, PARTY TO A TRANSACTION, "
                "or SHARED. Only CURRENT OWNER properties are owned by the user now; when the "
                "user owns none, say so and still list the linked properties with their "
                "relationship.\n"
                "- Questions about 'my property' cover every accessible property unless one is "
                "named.\n"
                "- Never reveal other people's names or personal details.\n"
                "- Cite exact IDs, dates, AED values and title deed numbers.\n"
                "- If the context does not contain the answer, say so plainly and suggest what "
                "to ask instead; never invent records.\n"
                "- To check a transaction for fraud or risk, tell the user to ask "
                '"Is transaction <ID> risky?" with an ID from the context.\n'
                "- Resolve follow-up words like 'it' or 'that property' from the conversation.\n"
                "- Be concise: 2-4 sentences, or short bullet points for lists."
            )
            user_msg = (
                (f"Conversation so far:\n{history}\n\n" if history else "")
                + f"User question: {question}\n\nContext:\n"
                + "\n".join(context)
                + '\n\nReturn a JSON object: {"answer": "your answer"}'
            )
            res = llm.chat_json(system_prompt, user_msg, agent_name=AGENT_NAME)
            if isinstance(res, dict) and res.get("answer"):
                return str(res["answer"])
        except Exception as exc:
            logger.warning("Assistant LLM answer failed, using rule-based answer: %s", exc)

    record_answer = _rule_based_record_answer(question, records)
    if record_answer:
        return record_answer

    if hits:
        return retrieval_service.synthesize_retrieval_answer(question, search_res)

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


def _rule_based_record_answer(question: str, records: list[dict[str, Any]]) -> str | None:
    """Answer common portfolio questions from the user's records when the LLM is unavailable."""
    if not records or not (_SELF_RE.search(question) or "propert" in question.lower()):
        return None
    q_lower = question.lower()
    owned = [r for r in records if r["is_owner"]]
    linked = [r for r in records if not r["is_owner"]]

    def name(r: dict[str, Any]) -> str:
        p = r["property"]
        return f"{p.property_name or p.property_id} ({p.district or 'Dubai'})"

    if any(k in q_lower for k in ("how many", "list", "which propert", "what propert", "own")):
        parts = [f"You have access to {len(records)} properties."]
        parts.append(
            f"You currently own {len(owned)}: " + "; ".join(name(r) for r in owned) + "."
            if owned
            else "You are not the current owner of any of them."
        )
        if linked:
            parts.append(
                "Linked to you: "
                + "; ".join(f"{name(r)} as {r['relationship']}" for r in linked)
                + "."
            )
        return " ".join(parts)

    if any(k in q_lower for k in ("document", "deed copy", "certificate")):
        lines = [
            f"{name(r)}: "
            + (
                ", ".join(
                    f"{d.document_type or 'document'} {d.document_number or ''} "
                    f"({d.verification_status or 'unverified'})".replace("  ", " ")
                    for d in r["documents"][:3]
                )
                or "no documents recorded"
            )
            for r in records[:MAX_CONTEXT_PROPERTIES]
        ]
        return "Documents on your properties:\n- " + "\n- ".join(lines)

    if any(k in q_lower for k in ("transaction", "sold", "sale", "bought", "purchase")):
        lines = [
            f"{name(r)}: latest {tx.transaction_id} on {_format_date(tx.transaction_datetime)} "
            f"for {_format_money(tx.transaction_value)}"
            for r in records[:MAX_CONTEXT_PROPERTIES]
            for tx in r["transactions"][:1]
        ]
        if lines:
            return "Latest transactions on your properties:\n- " + "\n- ".join(lines)

    if any(k in q_lower for k in ("value", "worth", "price", "valuation")):
        lines = [
            f"{name(r)}: current value {_format_money(r['property'].current_value)}"
            for r in records[:MAX_CONTEXT_PROPERTIES]
        ]
        return "Recorded values of your properties:\n- " + "\n- ".join(lines)

    if any(k in q_lower for k in ("encumbrance", "dispute", "mortgage", "restriction", "legal")):
        lines = [
            f"{name(r)}: legal status {r['property'].legal_status or 'Clear'}, "
            f"encumbrances {r['property'].encumbrances or 'None reported'}"
            for r in records[:MAX_CONTEXT_PROPERTIES]
        ]
        return "Legal status of your properties:\n- " + "\n- ".join(lines)

    if any(k in q_lower for k in ("title deed", "deed")):
        lines = [
            f"{name(r)}: title deed {r['property'].title_deed_number or 'N/A'}"
            for r in records[:MAX_CONTEXT_PROPERTIES]
        ]
        return "Title deeds of your properties:\n- " + "\n- ".join(lines)

    return None


def _save_query_log(
    db: Session,
    query_id: str,
    user_id: str,
    question: str,
    answer: str,
    confidence: float,
    elapsed_ms: int,
    flagged: bool = False,
    evidence: list[tuple[str | None, int | None, float]] | None = None,
) -> None:
    """Save user inquiry and response to core.query_logs and the ranked evidence
    (transaction_id, document_id, relevance) to core.query_retrievals."""
    try:
        evidence = evidence or []
        best_rel = max((rel for _, _, rel in evidence), default=confidence)
        log = QueryLog(
            query_id=query_id,
            user_id=user_id,
            query_text=question,
            log_timestamp=datetime.now(),
            agent_response=answer,
            confidence_score=Decimal(str(round(confidence, 4))),
            relevance_score=Decimal(str(round(best_rel, 4))),
            flagged_suspicious=flagged,
            agent_used=AGENT_NAME,
            response_time_ms=elapsed_ms,
        )
        db.add(log)
        db.flush()

        for rank, (tx_id, doc_id, rel) in enumerate(evidence, start=1):
            db.add(
                QueryRetrieval(
                    query_id=query_id,
                    transaction_id=tx_id,
                    document_id=doc_id,
                    rank=rank,
                    relevance_score=Decimal(str(round(rel, 4))),
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
    existing_inv_ids = orchestrator.reported_investigation_ids(
        db, [investigation_id_for(log.query_id) for log in logs]
    )

    items: list[UserAssistantHistoryItem] = []
    for log in logs:
        inv_id = investigation_id_for(log.query_id)
        mode: AssistantMode
        if inv_id in existing_inv_ids:
            mode, detail_url, link_id = "investigation", investigation_detail_url(inv_id), inv_id
        elif (log.agent_response or "").startswith(RESTRICTED_PREFIX):
            mode, detail_url, link_id = "restricted", None, None
        else:
            mode, detail_url, link_id = "retrieval", retrieval_detail_url(log.query_id), None

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
                mode=mode,
                detail_url=detail_url,
                investigation_id=link_id,
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
