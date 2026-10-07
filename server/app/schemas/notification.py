"""Phase 10 — Notification Pydantic Schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    user_id: str = Field(..., description="Target user ID")
    type: str = Field(
        ..., description="Type: PROPERTY_SHARED, RISK_REQUEST_COMPLETED, ACCESS_LEVEL_CHANGED, etc."
    )
    title: str = Field(..., description="Short notification title")
    message: str = Field(..., description="Full notification message text")
    link: str | None = Field(default=None, description="Optional deep link URL or UI route path")


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notification_id: str
    user_id: str
    type: str
    title: str
    message: str
    link: str | None = None
    is_read: bool = False
    created_at: datetime | None = None


class NotificationStats(BaseModel):
    unread_count: int
    total_count: int


class PaginatedNotifications(BaseModel):
    items: list[NotificationRead]
    total: int
    unread_count: int
    skip: int
    limit: int
