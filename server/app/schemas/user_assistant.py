from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UserAssistantQueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="Natural language question about user's properties or transactions",
    )


class UserAssistantSource(BaseModel):
    source_type: str = Field(..., description="property, transaction, or document")
    identifier: str
    title: str
    details: str | None = None


class UserAssistantQueryResponse(BaseModel):
    query_id: str
    question: str
    answer: str
    confidence_score: float
    timestamp: datetime
    sources: list[UserAssistantSource] = []
    scoped_properties_count: int = 0
    warnings: list[str] = []


class UserAssistantHistoryItem(BaseModel):
    query_id: str
    question: str
    answer: str
    confidence_score: float | None = None
    timestamp: datetime
    sources: list[UserAssistantSource] = []
