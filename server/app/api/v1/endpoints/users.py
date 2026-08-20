from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import require_roles
from app.schemas.user import User, UserCreate, UserUpdate
from app.repositories import user_repository
from app.core.database import get_db
from app.models.user import User as UserModel

router = APIRouter()


@router.post("/", response_model=User)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(["SUPER_ADMIN"])),
):
    existing = user_repository.get_user(db, user.user_id)
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")
    return user_repository.create_user(db=db, user=user)


@router.get("/{user_id}", response_model=User)
def read_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(["SUPER_ADMIN"])),
):
    db_user = user_repository.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.get("/", response_model=List[User])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(["SUPER_ADMIN"])),
):
    return user_repository.get_users(db, skip=skip, limit=limit)


@router.put("/{user_id}", response_model=User)
def update_user(
    user_id: str,
    user: UserUpdate,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(["SUPER_ADMIN"])),
):
    db_user = user_repository.update_user(db, user_id, user)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@router.delete("/{user_id}", response_model=User)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(["SUPER_ADMIN"])),
):
    db_user = user_repository.delete_user(db, user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user
