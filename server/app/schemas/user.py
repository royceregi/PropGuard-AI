from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.roles import AccessLevel


class UserPublic(BaseModel):
    user_id: str
    full_name: str | None = None
    email: str | None = None
    access_level: str
    wallet_address: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserPublic):
    username: str | None = None
    phone_number: str | None = None
    nic_hash: str | None = None
    kyc_status: str | None = None
    mfa_enabled: bool = False
    is_active: bool = False
    created_at: datetime | None = None
    last_login: datetime | None = None


class UserCreate(BaseModel):
    """Legacy create payload — prefer activating existing users via is_active."""

    user_id: str | None = None
    username: str
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    nic: str = Field(..., min_length=5, max_length=32, description="Raw NIC; stored as nic_hash only")
    access_level: AccessLevel = AccessLevel.STANDARD
    phone_number: str | None = None
    wallet_address: str | None = None
    kyc_status: str | None = None
    mfa_enabled: bool = False
    is_active: bool | None = None


class UserUpdate(BaseModel):
    username: str | None = None
    full_name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    nic: str | None = Field(
        default=None,
        min_length=5,
        max_length=32,
        description="Raw NIC; stored as nic_hash only",
    )
    access_level: AccessLevel | None = None
    phone_number: str | None = None
    wallet_address: str | None = None
    kyc_status: str | None = None
    mfa_enabled: bool | None = None
    is_active: bool | None = None


class UserActiveUpdate(BaseModel):
    is_active: bool


class UserAccessLevelUpdate(BaseModel):
    access_level: AccessLevel


class User(UserRead):
    """Backward-compatible response model for /api/v1/users."""


class UserStats(BaseModel):
    total_users: int = 0
    approved_users: int = 0
    pending_approval: int = 0
    public_users: int = 0
