from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import is_operational_access, permissions_for_access_level
from app.core.security import create_access_token, normalize_email, verify_password
from app.models.user import User
from app.repositories import user_repository
from app.api.deps import get_current_user
from app.schemas.auth import CurrentUserResponse, LoginRequest, LoginResponse
from app.schemas.user import UserPublic

router = APIRouter()


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
    level = (current_user.access_level or "").strip().upper()
    return CurrentUserResponse(
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        email=current_user.email,
        access_level=level,
        wallet_address=current_user.wallet_address,
        username=current_user.username,
        nic_hash=current_user.nic_hash,
        kyc_status=current_user.kyc_status,
        mfa_enabled=bool(current_user.mfa_enabled),
        is_active=bool(current_user.is_active),
        last_login=current_user.last_login,
        permissions=permissions_for_access_level(level),
    )
