"""Phase 8a — Property Share Schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PropertyShareCreate(BaseModel):
    buyer_user_id: str = Field(..., description="User ID of the prospective buyer")
    notes: str | None = Field(default=None, description="Optional notes or message for the buyer")
    expires_in_days: int | None = Field(
        default=30, ge=1, le=365, description="Access expiry duration in days"
    )


class PropertyShareRead(BaseModel):
    share_id: str
    property_id: str
    owner_user_id: str
    buyer_user_id: str
    notes: str | None = None
    created_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    is_active: bool = True
    property: dict[str, Any] | None = None
    owner: dict[str, Any] | None = None
    buyer: dict[str, Any] | None = None
