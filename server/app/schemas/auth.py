from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.user import UserPublic


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CurrentUserResponse(UserPublic):
    username: str | None = None
    phone_number: str | None = None
    nic_hash: str | None = None
    kyc_status: str | None = None
    mfa_enabled: bool = False
    is_active: bool = False
    last_login: datetime | None = None
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    detail: str


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    username: str | None = Field(default=None, min_length=3, max_length=100)
    phone_number: str | None = Field(default=None, max_length=50)
    nic: str | None = Field(default=None, min_length=5, max_length=32)


class RegisterResponse(BaseModel):
    user_id: str
    email: str
    full_name: str | None
    access_level: str
    kyc_status: str
    is_active: bool
    message: str
