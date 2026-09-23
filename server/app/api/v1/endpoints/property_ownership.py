from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.property import (
    PaginatedOwnershipHistory,
    PropertyOwnershipHistoryRead,
)

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY"]


@router.get("/", response_model=PaginatedOwnershipHistory)
def list_ownership_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    property_id: str | None = None,
    owner_id: str | None = None,
    ownership_status: str | None = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    items, total = property_repository.list_ownership_history(
        db,
        skip=skip,
        limit=limit,
        property_id=property_id,
        owner_id=owner_id,
        ownership_status=ownership_status,
        active_only=active_only,
    )
    return PaginatedOwnershipHistory(
        items=property_repository.enrich_ownership_rows(db, items),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{ownership_id}", response_model=PropertyOwnershipHistoryRead)
def get_ownership(
    ownership_id: int,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    row = property_repository.get_ownership(db, ownership_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Ownership record not found")
    return property_repository.enrich_ownership_rows(db, [row])[0]
