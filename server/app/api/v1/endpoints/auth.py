from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import is_operational_access, permissions_for_access_level
from app.core.security import (
    create_access_token,
    hash_password,
    normalize_email,
    verify_password,
)
from app.models.user import User
from app.repositories import user_repository
from app.api.deps import get_current_user
from app.schemas.auth import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    ProfileUpdateRequest,
)
from app.schemas.user import UserPublic

router = APIRouter()


def _current_user_response(user: User) -> CurrentUserResponse:
    level = (user.access_level or "").strip().upper()
    return CurrentUserResponse(
        user_id=user.user_id,
        full_name=user.full_name,
        email=user.email,
        access_level=level,
        wallet_address=user.wallet_address,
        username=user.username,
        phone_number=user.phone_number,
        nic_hash=user.nic_hash,
        kyc_status=user.kyc_status,
        mfa_enabled=bool(user.mfa_enabled),
        is_active=bool(user.is_active),
        last_login=user.last_login,
        permissions=permissions_for_access_level(level),
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    email = normalize_email(str(payload.email))
    user = user_repository.get_user_by_email(db, email=email)
    password_ok = verify_password(payload.password, user.password_hash if user else None)

    if user is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_level = (user.access_level or "").strip().upper()

    if access_level == "ELEVATED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending Super Admin approval",
        )

    if access_level == "STANDARD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has no system access yet. A registry or company must submit this account for approval.",
        )

    if not user.is_active:
        if (user.kyc_status or "").strip().upper() == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account was rejected",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    if not is_operational_access(access_level):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account access level is not authorized for sign-in",
        )

    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        user_id=user.user_id,
        email=user.email,
        access_level=access_level,
        full_name=user.full_name,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
    return _current_user_response(current_user)


@router.patch("/me", response_model=CurrentUserResponse)
def update_current_user_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile fields to update",
        )

    if "full_name" in data:
        name = (data["full_name"] or "").strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full name cannot be empty",
            )
        current_user.full_name = name

    if "phone_number" in data:
        phone = data["phone_number"]
        current_user.phone_number = (
            phone.strip() if isinstance(phone, str) and phone.strip() else None
        )

    db.commit()
    db.refresh(current_user)
    return _current_user_response(current_user)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return MessageResponse(detail="Password updated successfully")
