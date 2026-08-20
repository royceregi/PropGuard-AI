from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.roles import UserRole


class UserPublic(BaseModel):
    user_id: str
    full_name: str | None = None
    nic: str
    role: str
    wallet_address: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserPublic):
    username: str | None = None
    email: str | None = None
    kyc_status: str | None = None
    access_level: str | None = None
    mfa_enabled: bool = False
    is_active: bool = True
    created_at: datetime | None = None
    last_login: datetime | None = None


class UserCreate(BaseModel):
    user_id: str
    username: str
    full_name: str
    email: str
    password: str = Field(..., min_length=8, max_length=128)
    nic: str
    role: UserRole
    phone_number: str | None = None
    wallet_address: str | None = None
    kyc_status: str | None = None
    access_level: str | None = None
    mfa_enabled: bool = False
    is_active: bool = True


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    nic: str | None = None
    role: UserRole | None = None
    phone_number: str | None = None
    wallet_address: str | None = None
    kyc_status: str | None = None
    access_level: str | None = None
    mfa_enabled: bool | None = None
    is_active: bool | None = None


class User(UserRead):
    """Backward-compatible response model for /api/v1/users."""
