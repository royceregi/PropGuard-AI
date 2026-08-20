from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserPublic


class LoginRequest(BaseModel):
    nic: str = Field(..., min_length=5, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CurrentUserResponse(UserPublic):
    username: str | None = None
    email: str | None = None
    kyc_status: str | None = None
    access_level: str | None = None
    mfa_enabled: bool = False
    is_active: bool = True
    last_login: datetime | None = None
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)
