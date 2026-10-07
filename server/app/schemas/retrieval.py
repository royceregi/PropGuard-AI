from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class RetrievalHit(BaseModel):
    evidence_id: str
    source: str
    record_id: str
    rank: int
    relevance_score: float
    match: str
    intent: str | None = None
    title: str
    subtitle: str | None = None
    snippet: str | None = None
    property_id: str | None = None
    transaction_id: str | None = None
    document_id: int | None = None
    occurred_at: str | None = None
    value: float | None = None


class RetrievalResponse(BaseModel):
    query_id: str
    interpreted: dict[str, Any]
    sources: list[str]
    hits: list[RetrievalHit]
    counts: dict[str, int]
    warnings: list[str]
    response_time_ms: int
