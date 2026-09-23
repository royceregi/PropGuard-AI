from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import require_roles
from app.schemas.user import (
    User,
    UserAccessLevelUpdate,
    UserActiveUpdate,
    UserStats,
    UserUpdate,
)
from app.schemas.property import PaginatedUserRelatedProperties
from app.repositories import property_repository, user_repository
from app.core.database import get_db
from app.core.roles import AccessLevel
from app.models.user import User as UserModel

router = APIRouter()

DIRECTORY_LEVELS = [
    AccessLevel.SYSTEM.value,
    AccessLevel.REGISTRY.value,
    AccessLevel.COMPANY.value,
]
ACTIVATE_LEVELS = DIRECTORY_LEVELS
ADMIN_ONLY = [AccessLevel.SYSTEM.value]


def _ensure_visible(actor: UserModel, target: UserModel | None) -> UserModel:
    if target is None or not user_repository.actor_can_view_user(
        actor.access_level, target
    ):
        raise HTTPException(status_code=404, detail="User not found")
    return target


@router.get("/stats", response_model=UserStats)
def read_user_stats(
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(DIRECTORY_LEVELS)),
):
    return user_repository.get_user_stats(
        db, actor_access_level=actor.access_level
    )


@router.get("/", response_model=List[User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(DIRECTORY_LEVELS)),
):
    return user_repository.get_users(
        db,
        skip=skip,
        limit=limit,
        actor_access_level=actor.access_level,
    )


@router.get("/by-username/{username}", response_model=User)
def read_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(DIRECTORY_LEVELS)),
):
    db_user = user_repository.get_user_by_username(db, username=username)
    return _ensure_visible(actor, db_user)


@router.get("/{user_id}/properties", response_model=PaginatedUserRelatedProperties)
def list_user_properties(
    user_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(DIRECTORY_LEVELS)),
):
    existing = user_repository.get_user(db, user_id)
    _ensure_visible(actor, existing)
    items, total = property_repository.list_properties_for_user(
        db, user_id, skip=skip, limit=limit
    )
    return PaginatedUserRelatedProperties(
        items=items, total=total, skip=skip, limit=limit
    )


@router.post("/{user_id}/approve", response_model=User)
def approve_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(ACTIVATE_LEVELS)),
):
    existing = user_repository.get_user(db, user_id)
    _ensure_visible(actor, existing)
    db_user = user_repository.approve_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.post("/{user_id}/reject", response_model=User)
def reject_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ONLY)),
):
    db_user = user_repository.reject_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.patch("/{user_id}/active", response_model=User)
def set_user_active(
    user_id: str,
    payload: UserActiveUpdate,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(ACTIVATE_LEVELS)),
):
    existing = user_repository.get_user(db, user_id)
    _ensure_visible(actor, existing)
    db_user = user_repository.set_user_active(db, user_id, payload.is_active)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.patch("/{user_id}/access-level", response_model=User)
def set_user_access_level(
    user_id: str,
    payload: UserAccessLevelUpdate,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(ACTIVATE_LEVELS)),
):
    existing = user_repository.get_user(db, user_id)
    _ensure_visible(actor, existing)

    actor_level = (actor.access_level or "").strip().upper()
    next_level = payload.access_level.value
    current_level = (existing.access_level or "").strip().upper() if existing else ""

    if actor_level == AccessLevel.SYSTEM.value:
        allowed = {
            AccessLevel.STANDARD.value,
            AccessLevel.PUBLIC.value,
            AccessLevel.ELEVATED.value,
            AccessLevel.SYSTEM.value,
            AccessLevel.REGISTRY.value,
            AccessLevel.COMPANY.value,
        }
        if next_level not in allowed:
            raise HTTPException(status_code=400, detail="Invalid access level")
    else:
        # Registry / company: nominate STANDARD → ELEVATED (pending), or withdraw.
        end_user_levels = {
            AccessLevel.STANDARD.value,
            AccessLevel.ELEVATED.value,
        }
        if current_level == AccessLevel.PUBLIC.value:
            raise HTTPException(
                status_code=403,
                detail="Approved public users can only be changed by Super Admin",
            )
        if current_level not in end_user_levels:
            raise HTTPException(
                status_code=403,
                detail="You can only update standard or pending end-user accounts",
            )
        if next_level not in end_user_levels:
            raise HTTPException(
                status_code=403,
                detail="You can only submit for approval (Pending) or withdraw to Standard",
            )

    try:
        db_user = user_repository.set_user_access_level(
            db,
            user_id,
            next_level,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.get("/{user_id}", response_model=User)
def read_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(DIRECTORY_LEVELS)),
):
    db_user = user_repository.get_user(db, user_id=user_id)
    return _ensure_visible(actor, db_user)


@router.put("/{user_id}", response_model=User)
def update_user(
    user_id: str,
    user: UserUpdate,
    db: Session = Depends(get_db),
    actor: UserModel = Depends(require_roles(ACTIVATE_LEVELS)),
):
    existing = user_repository.get_user(db, user_id)
    _ensure_visible(actor, existing)
    if (actor.access_level or "").strip().upper() != AccessLevel.SYSTEM.value:
        allowed = {"is_active", "kyc_status"}
        provided = set(user.model_dump(exclude_unset=True).keys())
        if not provided.issubset(allowed):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update these fields",
            )
    db_user = user_repository.update_user(db, user_id, user)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.delete("/{user_id}", response_model=User)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ONLY)),
):
    db_user = user_repository.delete_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
