"""Scope property/transaction reads for PUBLIC users to own + shared only."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.roles import AccessLevel, normalize_access_level
from app.models.user import User as UserModel
from app.repositories import property_repository

AUTHORITY_LEVELS = {
    AccessLevel.SYSTEM.value,
    AccessLevel.REGISTRY.value,
    AccessLevel.COMPANY.value,
}


def is_authority_viewer(user: UserModel) -> bool:
    level = normalize_access_level(user.access_level)
    return level in AUTHORITY_LEVELS


def is_public_viewer(user: UserModel) -> bool:
    return normalize_access_level(user.access_level) == AccessLevel.PUBLIC.value


def scoped_property_ids(db: Session, user: UserModel) -> set[str] | None:
    """
    None = unrestricted (authority).
    set = PUBLIC may only see these property IDs (own + transaction-shared).
    """
    if is_authority_viewer(user):
        return None
    if is_public_viewer(user):
        return property_repository.accessible_property_ids_for_user(db, user.user_id)
    return set()


def ensure_property_access(db: Session, user: UserModel, property_id: str) -> None:
    if is_authority_viewer(user):
        return
    if is_public_viewer(user) and property_repository.user_can_access_property(
        db, user.user_id, property_id
    ):
        return
    raise HTTPException(status_code=404, detail="Property not found")


def ensure_transaction_access(
    db: Session, user: UserModel, transaction_id: str
) -> None:
    if is_authority_viewer(user):
        return
    if is_public_viewer(user) and property_repository.user_can_access_transaction(
        db, user.user_id, transaction_id
    ):
        return
    raise HTTPException(status_code=404, detail="Transaction not found")
