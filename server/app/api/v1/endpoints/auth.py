from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.roles import permissions_for_role
from app.core.security import create_access_token, normalize_nic, verify_password
from app.models.user import User
from app.repositories import user_repository
from app.api.deps import get_current_user
from app.schemas.auth import CurrentUserResponse, LoginRequest, LoginResponse
from app.schemas.user import UserPublic

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    nic = normalize_nic(payload.nic)
    user = user_repository.get_user_by_nic(db, nic=nic)
    password_ok = verify_password(payload.password, user.password_hash if user else None)

    if (
        user is None
        or not user.is_active
        or not password_ok
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid NIC or password",
        )

    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        user_id=user.user_id,
        nic=user.nic,
        role=user.role,
        full_name=user.full_name,
    )
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> CurrentUserResponse:
    return CurrentUserResponse(
        user_id=current_user.user_id,
        full_name=current_user.full_name,
        nic=current_user.nic,
        role=current_user.role,
        wallet_address=current_user.wallet_address,
        username=current_user.username,
        email=current_user.email,
        kyc_status=current_user.kyc_status,
        access_level=current_user.access_level,
        mfa_enabled=bool(current_user.mfa_enabled),
        is_active=bool(current_user.is_active),
        last_login=current_user.last_login,
        permissions=permissions_for_role(current_user.role),
    )
