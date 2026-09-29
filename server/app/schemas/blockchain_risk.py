from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class IndicatorEvidence(BaseModel):
    table: str | None = None
    id: str | None = None
    field: str | None = None
    expected: Any = None
    actual: Any = None


class BlockchainRiskIndicator(BaseModel):
    indicator_code: str
    indicator_name: str | None = None
    indicator_value: float | None = Field(default=None, description="Weight added to the score")
    severity: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    description: str | None = None
    evidence: list[IndicatorEvidence] = Field(default_factory=list)


class BlockchainRiskAssessment(BaseModel):
    assessment_id: int | None = None
    stored: bool = True
    transaction_id: str
    property_id: str | None = None
    integrity: str | None = None
    risk_score: float | None = Field(default=None, description="0–1; LOW < 0.40 ≤ MEDIUM < 0.70 ≤ HIGH")
    risk_level: Literal["LOW", "MEDIUM", "HIGH"] | None = None
    model_name: str | None = None
    model_version: str | None = None
    explanation: str | None = None
    review_status: str | None = None
    created_at: datetime | None = None
    features: dict[str, Any] | None = None
    indicators: list[BlockchainRiskIndicator] = Field(default_factory=list)


class AgentOutput(BaseModel):
    agent_name: str
    status: str
    confidence_score: float
    findings: dict[str, Any]
    evidence_ids: list[str]
    warnings: list[str]


class BlockchainInvestigationResponse(BaseModel):
    assessment: BlockchainRiskAssessment | None
    agents: list[AgentOutput]
    notice: str = (
        "This is a risk indicator for investigation, not a legal fraud judgment."
    )
