"""Information retrieval over properties, transactions, and document text (07-information-retrieval.md).

One query (natural language and/or structured filters) is answered by three paths, merged into a
single ranked evidence list:

1. Identifier lookup — transaction ID, property ID, title deed / document / registration number.
   Relevance 1.0; related records of a hinted source (e.g. "documents for <property>") 0.95.
2. Investigation intents — the example queries in 07 (high-value transactions, previous owners,
   document hash mismatches, rapid ownership changes, high-risk assessments) as structured SQL.
   Relevance 0.90 when the record passes the intent threshold, otherwise 0.70.
3. PostgreSQL full-text search over the sql/013 GIN indexes. Relevance = share of query terms the
   record contains × (0.7 + 0.3 × ts_rank_cd relative to the best match), so a record containing
   every term scores at least 0.70.

Rule-based only: no LLM is needed to parse or rank. Evidence IDs are stable "<table>:<id>" strings.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

SOURCES = ("property", "transaction", "document")
EVIDENCE_TABLES = {
    "property": "properties",
    "transaction": "property_transactions",
    "document": "property_documents",
    "ownership": "property_ownership_history",
    "assessment": "risk_assessments",
}

# Must match the index expressions in sql/013_full_text_search.sql.
DOCUMENT_TSV = "to_tsvector('english'::regconfig, coalesce(d.document_text, ''))"
PROPERTY_TSV = (
    "to_tsvector('english'::regconfig, "
    "coalesce(p.property_name, '') || ' ' || coalesce(p.address, '') || ' ' || "
    "coalesce(p.district, '') || ' ' || coalesce(p.city, '') || ' ' || "
    "coalesce(p.land_type, '') || ' ' || coalesce(p.current_usage_type, '') || ' ' || "
    "coalesce(p.legal_status, '') || ' ' || coalesce(p.encumbrances, ''))"
)
TRANSACTION_TSV = (
    "to_tsvector('english'::regconfig, "
    "coalesce(t.procedure_name, '') || ' ' || coalesce(t.area_name, '') || ' ' || "
    "coalesce(t.project_name, '') || ' ' || coalesce(t.master_project, '') || ' ' || "
    "coalesce(t.nearest_landmark, ''))"
)

EXACT_RELEVANCE = 1.0
RELATED_RELEVANCE = 0.95
INTENT_RELEVANCE = 0.90
INTENT_BELOW_THRESHOLD = 0.70
# Ranking recomputes to_tsvector per candidate; very common terms are ranked over this many rows.
FTS_CANDIDATE_CAP = 5000
HIGH_VALUE_PERCENTILE = 0.95
RAPID_CHANGE_PERCENTILE = 0.99

_TX_RE = re.compile(r"\b\d{1,2}-\d{1,4}-\d{4}-\d{1,7}\b")
_DEED_RE = re.compile(r"\bTD-[A-Z]{3}-\d{4,}\b", re.IGNORECASE)
_PROPERTY_RE = re.compile(r"\b\d{15,20}\b")
_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")

INTENTS: dict[str, re.Pattern[str]] = {
    "previous_owners": re.compile(
        r"\b(?:previous|past|former|prior|all)\s+owners?\b|\bownership\s+history\b|\bowners?\s+history\b",
        re.IGNORECASE,
    ),
    "high_value": re.compile(
        r"\bhigh(?:est)?[- ]value(?:d)?\b|\bexpensive\b|\blargest\s+(?:sales?|transactions?)\b",
        re.IGNORECASE,
    ),
    "hash_mismatch": re.compile(
        r"\b(?:document\s+)?hash(?:es)?\s+mismatch(?:es|ed)?\b|\bmismatch(?:ed|es)?\s+hash(?:es)?\b"
        r"|\btamper(?:ed|ing)?\b",
        re.IGNORECASE,
    ),
    "rapid_ownership_change": re.compile(
        r"\b(?:rapid|frequent|quick|repeated)\s+(?:ownership\s+)?(?:changes?|transfers?|resales?|flips?)\b"
        r"|\bflipp(?:ing|ed)\b",
        re.IGNORECASE,
    ),
    "high_risk": re.compile(
        r"\bhigh[- ]risk\b|\brisky\b|\bflagged\b|\bsuspicious\b", re.IGNORECASE
    ),
}
INTENT_LABELS = {
    "previous_owners": "Previous owners",
    "high_value": "High-value transactions",
    "hash_mismatch": "Document hash mismatches",
    "rapid_ownership_change": "Rapid ownership changes",
    "high_risk": "High-risk assessments",
}
SUSPICIOUS_INTENTS = {"hash_mismatch", "high_risk", "rapid_ownership_change"}

_SOURCE_HINTS = {
    "document": re.compile(r"\b(?:documents?|deeds?|certificates?)\b", re.IGNORECASE),
    "transaction": re.compile(r"\b(?:transactions?|sales?|transfers?)\b", re.IGNORECASE),
    "property": re.compile(r"\b(?:propert(?:y|ies)|parcels?|plots?)\b", re.IGNORECASE),
}
# Command and filler words that carry no search meaning in this domain.
_FILLER = {
    "show",
    "find",
    "list",
    "get",
    "give",
    "search",
    "display",
    "retrieve",
    "fetch",
    "look",
    "lookup",
    "all",
    "any",
    "every",
    "me",
    "my",
    "us",
    "please",
    "evidence",
    "records",
    "record",
    "details",
    "involving",
    "related",
    "regarding",
    "about",
    "for",
    "with",
    "which",
    "who",
    "what",
    "where",
    "when",
    "this",
    "that",
    "these",
    "those",
    "the",
    "a",
    "an",
    "of",
    "in",
    "on",
    "at",
    "by",
    "from",
    "to",
    "and",
    "or",
    "is",
    "are",
    "was",
    "were",
    "be",
    "has",
    "have",
    "had",
    "there",
    "property",
    "properties",
    "transaction",
    "transactions",
    "document",
    "documents",
    "deed",
    "deeds",
    "id",
    "number",
    "between",
    "during",
    "since",
    "year",
    "years",
}


@dataclass
class ParsedQuery:
    """What the parser understood; returned to the client as `interpreted`."""

    text: str
    transaction_ids: list[str] = field(default_factory=list)
    property_ids: list[str] = field(default_factory=list)
    title_deeds: list[str] = field(default_factory=list)
    intents: list[str] = field(default_factory=list)
    source_hints: list[str] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None
    terms: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("text")
        return data


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


def parse_query(raw: str) -> ParsedQuery:
    """Extract identifiers, intents, source hints, a year range, and the remaining search terms."""
    query = " ".join((raw or "").split())
    parsed = ParsedQuery(text=query)
    rest = query

    parsed.transaction_ids = _unique(_TX_RE.findall(rest))
    rest = _TX_RE.sub(" ", rest)
    parsed.title_deeds = _unique([m.upper() for m in _DEED_RE.findall(rest)])
    rest = _DEED_RE.sub(" ", rest)
    parsed.property_ids = _unique(_PROPERTY_RE.findall(rest))
    rest = _PROPERTY_RE.sub(" ", rest)

    years = sorted({int(y) for y in _YEAR_RE.findall(rest)})
    if years:
        parsed.date_from = date(years[0], 1, 1)
        parsed.date_to = date(years[-1], 12, 31)
        rest = _YEAR_RE.sub(" ", rest)

    for code, pattern in INTENTS.items():
        if pattern.search(rest):
            parsed.intents.append(code)
            rest = pattern.sub(" ", rest)

    parsed.source_hints = [
        source for source, pattern in _SOURCE_HINTS.items() if pattern.search(rest)
    ]

    words = re.findall(r"[\w/'-]+|\"[^\"]+\"", rest)
    parsed.terms = " ".join(w for w in words if w.lower().strip("'") not in _FILLER).strip()
    return parsed


# --------------------------------------------------------------------------------------------
# Hits and merging
# --------------------------------------------------------------------------------------------


def make_hit(
    source: str,
    record_id: Any,
    *,
    relevance: float,
    match: str,
    title: str,
    subtitle: str | None = None,
    snippet: str | None = None,
    property_id: str | None = None,
    transaction_id: str | None = None,
    document_id: int | None = None,
    occurred_at: Any = None,
    value: Any = None,
    intent: str | None = None,
) -> dict[str, Any]:
    return {
        "evidence_id": f"{EVIDENCE_TABLES[source]}:{record_id}",
        "source": source,
        "record_id": str(record_id),
        "rank": 0,
        "relevance_score": round(max(0.0, min(1.0, float(relevance))), 4),
        "match": match,
        "intent": intent,
        "title": title,
        "subtitle": subtitle,
        "snippet": snippet,
        "property_id": property_id,
        "transaction_id": transaction_id,
        "document_id": document_id,
        "occurred_at": occurred_at.isoformat()
        if hasattr(occurred_at, "isoformat")
        else occurred_at,
        "value": float(value) if value is not None else None,
    }


def merge_hits(groups: list[list[dict[str, Any]]], limit: int) -> list[dict[str, Any]]:
    """Dedupe by evidence_id (keep the most relevant), sort by relevance, keep path order on ties."""
    best: dict[str, dict[str, Any]] = {}
    order: dict[str, int] = {}
    for group in groups:
        for hit in group:
            key = hit["evidence_id"]
            order.setdefault(key, len(order))
            if key not in best or hit["relevance_score"] > best[key]["relevance_score"]:
                best[key] = hit
    ranked = sorted(best.values(), key=lambda h: (-h["relevance_score"], order[h["evidence_id"]]))[
        :limit
    ]
    for position, hit in enumerate(ranked, start=1):
        hit["rank"] = position
    return ranked


# --------------------------------------------------------------------------------------------
# SQL helpers
# --------------------------------------------------------------------------------------------


@dataclass
class _Scope:
    """Filters shared by every path. property_ids None = unrestricted."""

    property_ids: list[str] | None
    date_from: date | None
    date_to: date | None

    def clause(self, alias: str, params: dict[str, Any], date_column: str | None = None) -> str:
        parts: list[str] = []
        if self.property_ids is not None:
            parts.append(f"{alias}.property_id = ANY(:scope_ids)")
            params["scope_ids"] = self.property_ids
        if date_column and self.date_from:
            parts.append(f"{alias}.{date_column} >= :date_from")
            params["date_from"] = self.date_from
        if date_column and self.date_to:
            parts.append(f"{alias}.{date_column} < (:date_to)::date + 1")
            params["date_to"] = self.date_to
        return "".join(f" AND {part}" for part in parts)


def _rows(db: Session, sql: str, params: dict[str, Any]) -> list[Any]:
    return db.execute(text(sql), params).mappings().all()


_percentile_cache: dict[tuple[str, str, float], float] = {}


def _percentile(db: Session, table: str, column: str, q: float) -> float:
    key = (table, column, q)
    if key not in _percentile_cache:
        value = db.execute(
            text(f"SELECT percentile_cont(:q) WITHIN GROUP (ORDER BY {column}) FROM core.{table}"),
            {"q": q},
        ).scalar()
        _percentile_cache[key] = float(value or 0)
    return _percentile_cache[key]


def _tx_title(row: Any) -> str:
    return (
        " · ".join(str(v) for v in (row["procedure_name"], row["area_name"]) if v)
        or row["transaction_id"]
    )


def _tx_hit(
    row: Any,
    *,
    relevance: float,
    match: str,
    intent: str | None = None,
    subtitle: str | None = None,
):
    return make_hit(
        "transaction",
        row["transaction_id"],
        relevance=relevance,
        match=match,
        intent=intent,
        title=_tx_title(row),
        subtitle=subtitle or row.get("project_name"),
        property_id=row["property_id"],
        transaction_id=row["transaction_id"],
        occurred_at=row["transaction_datetime"],
        value=row["transaction_value"],
    )


def _doc_hit(
    row: Any, *, relevance: float, match: str, intent: str | None = None, snippet: str | None = None
):
    return make_hit(
        "document",
        row["document_id"],
        relevance=relevance,
        match=match,
        intent=intent,
        title=" · ".join(str(v) for v in (row["document_type"], row["document_number"]) if v),
        subtitle=row.get("verification_status"),
        snippet=snippet,
        property_id=row["property_id"],
        transaction_id=row["transaction_id"],
        document_id=int(row["document_id"]),
        occurred_at=row["issued_date"],
    )


def _property_hit(row: Any, *, relevance: float, match: str, snippet: str | None = None):
    location = ", ".join(str(v) for v in (row["district"], row["city"]) if v)
    return make_hit(
        "property",
        row["property_id"],
        relevance=relevance,
        match=match,
        title=row["property_name"] or row["address"] or row["property_id"],
        subtitle=" · ".join(v for v in (location, row["legal_status"]) if v) or None,
        snippet=snippet,
        property_id=row["property_id"],
        value=row["current_value"],
    )


_TX_COLUMNS = (
    "t.transaction_id, t.property_id, t.procedure_name, t.area_name, t.project_name, "
    "t.transaction_datetime, t.transaction_value"
)
_DOC_COLUMNS = (
    "d.document_id, d.property_id, d.transaction_id, d.document_type, d.document_number, "
    "d.issued_date, d.verification_status"
)
_PROPERTY_COLUMNS = (
    "p.property_id, p.property_name, p.address, p.district, p.city, p.legal_status, p.current_value"
)


# --------------------------------------------------------------------------------------------
# Path 1: identifiers
# --------------------------------------------------------------------------------------------


def _identifier_hits(
    db: Session, parsed: ParsedQuery, scope: _Scope, sources: set[str], limit: int
) -> tuple[list[dict[str, Any]], list[str]]:
    """Exact records named in the query, plus related records for hinted sources.

    Returns the hits and the property IDs the identifiers resolve to (used to focus intents).
    """
    hits: list[dict[str, Any]] = []
    property_ids = list(parsed.property_ids)
    hinted = set(parsed.source_hints) & sources

    if parsed.transaction_ids:
        params: dict[str, Any] = {"ids": parsed.transaction_ids}
        where = scope.clause("t", params)
        rows = _rows(
            db,
            f"SELECT {_TX_COLUMNS} FROM core.property_transactions t "
            f"WHERE t.transaction_id = ANY(:ids){where}",
            params,
        )
        hits += [_tx_hit(r, relevance=EXACT_RELEVANCE, match="identifier") for r in rows]
        property_ids += [r["property_id"] for r in rows if r["property_id"]]
        if "document" in sources:
            params = {"ids": parsed.transaction_ids, "limit": limit}
            where = scope.clause("d", params)
            rows = _rows(
                db,
                f"SELECT {_DOC_COLUMNS} FROM core.property_documents d "
                f"WHERE d.transaction_id = ANY(:ids){where} ORDER BY d.issued_date DESC LIMIT :limit",
                params,
            )
            hits += [_doc_hit(r, relevance=RELATED_RELEVANCE, match="related") for r in rows]

    if parsed.title_deeds:
        params = {"ids": parsed.title_deeds}
        where = scope.clause("p", params)
        rows = _rows(
            db,
            f"SELECT {_PROPERTY_COLUMNS} FROM core.properties p "
            f"WHERE upper(p.title_deed_number) = ANY(:ids){where}",
            params,
        )
        hits += [_property_hit(r, relevance=EXACT_RELEVANCE, match="identifier") for r in rows]
        property_ids += [r["property_id"] for r in rows]

        params = {"ids": parsed.title_deeds}
        where = scope.clause("d", params)
        rows = _rows(
            db,
            f"SELECT {_DOC_COLUMNS} FROM core.property_documents d "
            f"WHERE upper(d.document_number) = ANY(:ids){where}",
            params,
        )
        hits += [_doc_hit(r, relevance=EXACT_RELEVANCE, match="identifier") for r in rows]

        params = {"ids": parsed.title_deeds}
        where = scope.clause("t", params)
        rows = _rows(
            db,
            f"SELECT {_TX_COLUMNS} FROM core.registration_details r "
            f"JOIN core.property_transactions t ON t.transaction_id = r.transaction_id "
            f"WHERE upper(r.registration_number) = ANY(:ids){where}",
            params,
        )
        hits += [
            _tx_hit(r, relevance=EXACT_RELEVANCE, match="identifier", subtitle="Registration match")
            for r in rows
        ]

    if parsed.property_ids:
        params = {"ids": parsed.property_ids}
        where = scope.clause("p", params)
        rows = _rows(
            db,
            f"SELECT {_PROPERTY_COLUMNS} FROM core.properties p "
            f"WHERE p.property_id = ANY(:ids){where}",
            params,
        )
        hits += [_property_hit(r, relevance=EXACT_RELEVANCE, match="identifier") for r in rows]

    named_properties = _unique([pid for pid in property_ids if pid])
    # "documents / transactions for <property>": related records, unless an intent will select them.
    if named_properties and not parsed.intents:
        if "transaction" in hinted:
            params = {"ids": named_properties, "limit": limit}
            where = scope.clause("t", params, "transaction_datetime")
            rows = _rows(
                db,
                f"SELECT {_TX_COLUMNS} FROM core.property_transactions t "
                f"WHERE t.property_id = ANY(:ids){where} "
                f"ORDER BY t.transaction_datetime DESC LIMIT :limit",
                params,
            )
            hits += [_tx_hit(r, relevance=RELATED_RELEVANCE, match="related") for r in rows]
        if "document" in hinted:
            params = {"ids": named_properties, "limit": limit}
            where = scope.clause("d", params, "issued_date")
            rows = _rows(
                db,
                f"SELECT {_DOC_COLUMNS} FROM core.property_documents d "
                f"WHERE d.property_id = ANY(:ids){where} "
                f"ORDER BY d.issued_date DESC LIMIT :limit",
                params,
            )
            hits += [_doc_hit(r, relevance=RELATED_RELEVANCE, match="related") for r in rows]
    return hits, named_properties


# --------------------------------------------------------------------------------------------
# Path 2: investigation intents
# --------------------------------------------------------------------------------------------


def _focus(alias: str, property_ids: list[str], params: dict[str, Any]) -> str:
    if not property_ids:
        return ""
    params["focus_ids"] = property_ids
    return f" AND {alias}.property_id = ANY(:focus_ids)"


def _intent_high_value(db, scope, focus, limit):
    threshold = _percentile(db, "property_transactions", "transaction_value", HIGH_VALUE_PERCENTILE)
    params: dict[str, Any] = {"limit": limit, "threshold": threshold}
    where = scope.clause("t", params, "transaction_datetime") + _focus("t", focus, params)
    # Within a named property, list its largest transactions even below the registry threshold.
    floor = "" if focus else " AND t.transaction_value >= :threshold"
    rows = _rows(
        db,
        f"SELECT {_TX_COLUMNS} FROM core.property_transactions t "
        f"WHERE t.transaction_value IS NOT NULL{floor}{where} "
        f"ORDER BY t.transaction_value DESC LIMIT :limit",
        params,
    )
    return [
        _tx_hit(
            r,
            relevance=INTENT_RELEVANCE
            if float(r["transaction_value"]) >= threshold
            else INTENT_BELOW_THRESHOLD,
            match="intent",
            intent="high_value",
            subtitle=f"Top {round((1 - HIGH_VALUE_PERCENTILE) * 100)}% of registry values"
            if float(r["transaction_value"]) >= threshold
            else "Below the registry high-value threshold",
        )
        for r in rows
    ]


def _intent_previous_owners(db, scope, focus, limit):
    params: dict[str, Any] = {"limit": limit, "ids": focus}
    where = scope.clause("o", params, "ownership_start_date")
    rows = _rows(
        db,
        "SELECT o.ownership_id, o.property_id, o.owner_id, o.ownership_start_date, "
        "o.ownership_end_date, o.ownership_type, o.ownership_status, o.transaction_id "
        "FROM core.property_ownership_history o "
        f"WHERE o.property_id = ANY(:ids){where} "
        "ORDER BY o.ownership_start_date DESC NULLS LAST LIMIT :limit",
        params,
    )
    return [
        make_hit(
            "ownership",
            r["ownership_id"],
            relevance=INTENT_RELEVANCE,
            match="intent",
            intent="previous_owners",
            title=f"Owner {r['owner_id']}",
            subtitle=" · ".join(str(v) for v in (r["ownership_status"], r["ownership_type"]) if v)
            or None,
            snippet=f"{r['ownership_start_date'] or '?'} → {r['ownership_end_date'] or 'present'}",
            property_id=r["property_id"],
            transaction_id=r["transaction_id"],
            occurred_at=r["ownership_start_date"],
        )
        for r in rows
    ]


def _intent_hash_mismatch(db, scope, focus, limit):
    """Documents whose stored hash no longer equals SHA256(document_text) (core/hashing.py)."""
    params: dict[str, Any] = {"limit": limit}
    where = scope.clause("d", params, "issued_date") + _focus("d", focus, params)
    rows = _rows(
        db,
        f"SELECT {_DOC_COLUMNS} FROM core.property_documents d "
        "WHERE d.document_hash IS DISTINCT FROM "
        "encode(sha256(convert_to(coalesce(d.document_text, ''), 'UTF8')), 'hex')"
        f"{where} ORDER BY d.issued_date DESC NULLS LAST LIMIT :limit",
        params,
    )
    return [
        _doc_hit(
            r,
            relevance=RELATED_RELEVANCE,
            match="intent",
            intent="hash_mismatch",
            snippet="Stored document_hash does not match SHA-256 of the current document text.",
        )
        for r in rows
    ]


def _intent_rapid_change(db, scope, focus, limit):
    threshold = _percentile(
        db, "transaction_features", "transactions_last_90_days", RAPID_CHANGE_PERCENTILE
    )
    params: dict[str, Any] = {"limit": limit}
    where = scope.clause("t", params, "transaction_datetime") + _focus("t", focus, params)
    rows = _rows(
        db,
        f"SELECT {_TX_COLUMNS}, f.transactions_last_90_days, f.transactions_last_365_days "
        "FROM core.transaction_features f "
        "JOIN core.property_transactions t ON t.transaction_id = f.transaction_id "
        f"WHERE f.transactions_last_90_days > 0{where} "
        "ORDER BY f.transactions_last_90_days DESC, f.transactions_last_365_days DESC "
        "LIMIT :limit",
        params,
    )
    return [
        _tx_hit(
            r,
            relevance=INTENT_RELEVANCE
            if r["transactions_last_90_days"] >= threshold
            else INTENT_BELOW_THRESHOLD,
            match="intent",
            intent="rapid_ownership_change",
            subtitle=f"{r['transactions_last_90_days']} transactions in 90 days, "
            f"{r['transactions_last_365_days']} in 365 days",
        )
        for r in rows
    ]


def _intent_high_risk(db, scope, focus, limit):
    params: dict[str, Any] = {"limit": limit}
    where = scope.clause("a", params) + _focus("a", focus, params)
    rows = _rows(
        db,
        "SELECT * FROM (SELECT DISTINCT ON (a.transaction_id) a.assessment_id, a.transaction_id, "
        "a.property_id, a.risk_score, a.risk_level, a.explanation, a.created_at "
        "FROM core.risk_assessments a "
        f"WHERE a.transaction_id IS NOT NULL{where} "
        "ORDER BY a.transaction_id, a.created_at DESC) latest "
        "WHERE latest.risk_level IN ('HIGH', 'MEDIUM') "
        "ORDER BY latest.risk_score DESC LIMIT :limit",
        params,
    )
    return [
        make_hit(
            "assessment",
            r["assessment_id"],
            relevance=INTENT_RELEVANCE if r["risk_level"] == "HIGH" else INTENT_BELOW_THRESHOLD,
            match="intent",
            intent="high_risk",
            title=f"{r['risk_level']} risk · {r['transaction_id']}",
            subtitle=f"Score {float(r['risk_score']):.2f}",
            snippet=(r["explanation"] or "")[:240] or None,
            property_id=r["property_id"],
            transaction_id=r["transaction_id"],
            occurred_at=r["created_at"],
        )
        for r in rows
    ]


_INTENT_HANDLERS = {
    "high_value": _intent_high_value,
    "previous_owners": _intent_previous_owners,
    "hash_mismatch": _intent_hash_mismatch,
    "rapid_ownership_change": _intent_rapid_change,
    "high_risk": _intent_high_risk,
}


# --------------------------------------------------------------------------------------------
# Path 3: full-text search
# --------------------------------------------------------------------------------------------


def _lexemes(db: Session, terms: str) -> list[str]:
    rows = db.execute(
        text("SELECT lexeme FROM unnest(to_tsvector('english', :t))"), {"t": terms}
    ).all()
    return [row[0] for row in rows]


_FTS_SPECS = {
    "document": (
        DOCUMENT_TSV,
        "core.property_documents d",
        "d",
        "issued_date",
        _DOC_COLUMNS + ", d.document_text",
    ),
    "transaction": (
        TRANSACTION_TSV,
        "core.property_transactions t",
        "t",
        "transaction_datetime",
        _TX_COLUMNS,
    ),
    "property": (PROPERTY_TSV, "core.properties p", "p", None, _PROPERTY_COLUMNS),
}


def _fts_source(
    db: Session,
    source: str,
    terms: str,
    lexemes: list[str],
    scope: _Scope,
    limit: int,
    *,
    any_term: bool,
) -> tuple[list[dict[str, Any]], bool]:
    """(hits, candidate cap reached) for one source."""
    tsv, table, alias, date_column, columns = _FTS_SPECS[source]
    params: dict[str, Any] = {
        "terms": terms,
        "lexemes": lexemes,
        "cap": FTS_CANDIDATE_CAP,
        "limit": limit,
    }
    if any_term:
        query_expr = "array_to_string(ARRAY(SELECT quote_literal(x) FROM unnest(CAST(:lexemes AS text[])) x), ' | ')::tsquery"
    else:
        query_expr = "websearch_to_tsquery('english', :terms)"
    coverage = " + ".join(
        f"({tsv} @@ quote_literal(:lex{i})::tsquery)::int" for i in range(len(lexemes))
    )
    for i, lexeme in enumerate(lexemes):
        params[f"lex{i}"] = lexeme
    where = scope.clause(alias, params, date_column)
    headline = (
        ", ts_headline('english', c.document_text, c.query, "
        "'StartSel=[[, StopSel=]], MaxWords=28, MinWords=10, MaxFragments=2, FragmentDelimiter= … ') AS snippet"
        if source == "document"
        else ""
    )
    sql = f"""
        WITH q AS (SELECT {query_expr} AS query),
        candidates AS (
            SELECT {columns}, q.query, {tsv} AS vec
            FROM {table}, q
            WHERE {tsv} @@ q.query{where}
            LIMIT :cap
        ),
        scored AS (
            SELECT c.*, ts_rank_cd(c.vec, c.query, 32) AS rank_score,
                   ({coverage.replace(tsv, "c.vec")})::float / {len(lexemes)} AS coverage
            FROM candidates c
        )
        SELECT c.*, max(c.rank_score) OVER () AS best_rank{headline}
        FROM scored c
        ORDER BY c.coverage DESC, c.rank_score DESC
        LIMIT :limit
    """
    rows = _rows(db, sql, params)
    capped = False
    if len(rows) == limit:
        capped = bool(
            db.execute(
                text(
                    f"SELECT count(*) >= :cap FROM (SELECT 1 FROM {table} WHERE {tsv} @@ "
                    f"({query_expr}){where} LIMIT :cap) s"
                ),
                params,
            ).scalar()
        )

    hits = []
    for row in rows:
        best = float(row["best_rank"] or 0) or 1.0
        relevance = float(row["coverage"]) * (0.7 + 0.3 * float(row["rank_score"]) / best)
        match = "full_text_any" if any_term else "full_text"
        if source == "document":
            hits.append(_doc_hit(row, relevance=relevance, match=match, snippet=row["snippet"]))
        elif source == "transaction":
            hits.append(_tx_hit(row, relevance=relevance, match=match))
        else:
            snippet = " · ".join(str(v) for v in (row["address"], row["legal_status"]) if v) or None
            hits.append(_property_hit(row, relevance=relevance, match=match, snippet=snippet))
    return hits, capped


def _fts_hits(
    db: Session, terms: str, scope: _Scope, sources: list[str], limit: int
) -> tuple[list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    lexemes = _lexemes(db, terms)
    if not lexemes:
        return [], warnings
    hits: list[dict[str, Any]] = []
    capped_sources: list[str] = []
    for source in sources:
        found, capped = _fts_source(db, source, terms, lexemes, scope, limit, any_term=False)
        if not found and len(lexemes) > 1:
            found, capped = _fts_source(db, source, terms, lexemes, scope, limit, any_term=True)
            if found:
                warnings.append(
                    f"No {source} record matched every term; showing {source} records matching some terms."
                )
        if capped:
            capped_sources.append(source)
        hits += found
    if capped_sources:
        warnings.append(
            f"Broad query: {', '.join(capped_sources)} results were ranked over the first "
            f"{FTS_CANDIDATE_CAP} matches. Add terms or filters to narrow it."
        )
    return hits, warnings


# --------------------------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------------------------


def search(
    db: Session,
    query: str,
    *,
    sources: list[str] | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 20,
    property_scope: set[str] | None = None,
) -> dict[str, Any]:
    """Ranked evidence for one query. property_scope None = unrestricted; a set limits PUBLIC users."""
    parsed = parse_query(query)
    parsed.date_from = date_from or parsed.date_from
    parsed.date_to = date_to or parsed.date_to
    requested = [s for s in (sources or SOURCES) if s in SOURCES] or list(SOURCES)
    # Hints in the text ("documents …") narrow full-text search when the caller did not pick sources.
    fts_sources = [s for s in requested if s in parsed.source_hints] if not sources else requested
    fts_sources = fts_sources or requested

    warnings: list[str] = []
    if property_scope is not None and not property_scope:
        return {
            "interpreted": parsed.to_dict(),
            "sources": requested,
            "hits": [],
            "counts": {},
            "warnings": ["You have no own or shared properties to search."],
        }

    scope = _Scope(
        property_ids=sorted(property_scope) if property_scope is not None else None,
        date_from=parsed.date_from,
        date_to=parsed.date_to,
    )
    groups: list[list[dict[str, Any]]] = []

    id_hits, focus = _identifier_hits(db, parsed, scope, set(requested), limit)
    groups.append(id_hits)
    if (parsed.transaction_ids or parsed.title_deeds or parsed.property_ids) and not id_hits:
        warnings.append("No accessible record matches the identifier in the query.")

    for code in parsed.intents:
        if code == "previous_owners" and not focus:
            warnings.append(
                "Name a property ID, title deed, or transaction ID to list previous owners."
            )
            continue
        found = _INTENT_HANDLERS[code](db, scope, focus, limit)
        if not found:
            warnings.append(f"{INTENT_LABELS[code]}: no matching records.")
        groups.append(found)

    if parsed.terms:
        fts, fts_warnings = _fts_hits(db, parsed.terms, scope, fts_sources, limit)
        groups.append(fts)
        warnings += fts_warnings
    elif not parsed.intents and not id_hits:
        warnings.append("Nothing to search for: add an identifier, a topic, or search terms.")

    hits = merge_hits(groups, limit)
    counts: dict[str, int] = {}
    for hit in hits:
        counts[hit["source"]] = counts.get(hit["source"], 0) + 1
    return {
        "interpreted": parsed.to_dict(),
        "sources": requested,
        "hits": hits,
        "counts": counts,
        "warnings": warnings,
    }
