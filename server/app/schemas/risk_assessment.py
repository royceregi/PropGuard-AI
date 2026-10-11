from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

# ISSUES_FOUND is stored as VERIFIED with at least one section marked as an issue.
RequestStatus = Literal["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ISSUES_FOUND", "REJECTED"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]
AccessType = Literal["OWNER", "SHARED"]
SignalStatus = Literal["PASS", "WARN", "FAIL", "INFO"]

VERIFICATION_SECTIONS = ("property_details", "title_records", "boundaries", "owner_details")


class RiskRequestCreate(BaseModel):
    property_id: str = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=2000)
    include_evidence: bool = True

    @field_validator("property_id")
    @classmethod
    def _strip_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Property ID is required")
        return cleaned


class VerificationChecks(BaseModel):
    property_details: bool | None = None
    title_records: bool | None = None
    boundaries: bool | None = None
    owner_details: bool | None = None


class RiskDraftUpdate(BaseModel):
    verification_checks: VerificationChecks | None = None
    risk_score: int | None = Field(default=None, ge=0, le=100)
    registry_notes: str | None = Field(default=None, max_length=5000)


class RiskVerifyRequest(BaseModel):
    verification_checks: VerificationChecks
    risk_score: int = Field(ge=0, le=100)
    registry_notes: str = Field(min_length=1, max_length=5000)

    @field_validator("registry_notes")
    @classmethod
    def _notes_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Registry evaluation notes are required")
        return cleaned


class RiskRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def _reason_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("A rejection reason is required")
        return cleaned


class HistoryEvent(BaseModel):
    status: str
    at: datetime
    by: str | None = None
    by_name: str | None = None
    note: str | None = None


class RiskSignal(BaseModel):
    code: str
    label: str
    status: SignalStatus
    weight: int
    detail: str


class SystemChecks(BaseModel):
    signals: list[RiskSignal]
    suggested_score: int
    suggested_level: RiskLevel
    evaluated_at: datetime


class RequesterSummary(BaseModel):
    user_id: str
    full_name: str | None = None
    access_level: str


class RiskRequestSummary(BaseModel):
    request_id: str
    property_id: str
    property_title: str | None = None
    status: RequestStatus
    submitted_at: datetime
    completed_at: datetime | None = None
    risk_score: int | None = None
    risk_level: RiskLevel | None = None
    requester: RequesterSummary
    is_own_request: bool = False


class RiskRequestDetail(RiskRequestSummary):
    requester_notes: str | None = None
    include_evidence: bool
    submitted_snapshot: dict[str, Any]
    verification_checks: VerificationChecks
    registry_notes: str | None = None
    rejection_reason: str | None = None
    system_signals: SystemChecks | None = None
    result_hash: str | None = None
    review_started_at: datetime | None = None
    reviewer_name: str | None = None
    history: list[HistoryEvent] = Field(default_factory=list)
    can_download_certificate: bool = False


class RegistryWorkspace(BaseModel):
    request: RiskRequestDetail
    current_property: dict[str, Any] | None
    snapshot_changes: list[dict[str, Any]]
    system_checks: SystemChecks


class PropertyAccessRow(BaseModel):
    property_id: str
    property_title: str | None = None
    location: str | None = None
    access: AccessType
    request: RiskRequestSummary | None = None
    can_request: bool


class RequesterOverviewSummary(BaseModel):
    active_requests: int
    completed_assessments: int
    shared_with_me: int


class RequesterOverview(BaseModel):
    summary: RequesterOverviewSummary
    my_properties: list[PropertyAccessRow]
    shared_with_me: list[PropertyAccessRow]


class QueueSummary(BaseModel):
    pending_intake: int
    under_review: int
    needs_clarification: int
    completed_today: int


class RegistryQueue(BaseModel):
    summary: QueueSummary
    items: list[RiskRequestSummary]
    total: int
