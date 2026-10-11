from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.property_access import (
    ensure_property_access,
    scoped_property_ids,
)
from app.core.database import get_db
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.property import (
    PaginatedOwnershipHistory,
    PaginatedProperties,
    PaginatedPropertyDocuments,
    PaginatedPropertyTransactions,
    PaginatedUserRelatedProperties,
    PropertyDetailRead,
    PropertyRead,
)

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
# Full per-property history lists; other users only get the latest rows via /full.
HISTORY_ROLES = ["SYSTEM", "REGISTRY"]
DETAIL_PREVIEW_LIMIT = 5


@router.get("/", response_model=PaginatedProperties)
def list_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, description="Search id, name, deed, address, owner"),
    district: str | None = None,
    city: str | None = None,
    land_type: str | None = None,
    usage_type: str | None = None,
    verification_status: str | None = None,
    legal_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    allowed_ids = scoped_property_ids(db, current_user)
    items, total = property_repository.list_properties(
        db,
        skip=skip,
        limit=limit,
        q=q,
        district=district,
        city=city,
        land_type=land_type,
        usage_type=usage_type,
        verification_status=verification_status,
        legal_status=legal_status,
        property_ids=allowed_ids,
    )
    return PaginatedProperties(
        items=property_repository.enrich_properties(db, items),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/mine", response_model=PaginatedUserRelatedProperties)
def list_my_properties(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    """Properties linked to the signed-in user (owner, history, or shared party)."""
    items, total = property_repository.list_properties_for_user(
        db, current_user.user_id, skip=skip, limit=limit
    )
    return PaginatedUserRelatedProperties(items=items, total=total, skip=skip, limit=limit)


@router.get("/{property_id}", response_model=PropertyRead)
def get_property(
    property_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    row = property_repository.get_property(db, property_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_repository.enrich_properties(db, [row])[0]


@router.get("/{property_id}/full", response_model=PropertyDetailRead)
def get_property_full(
    property_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    row = property_repository.get_property(db, property_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Property not found")

    documents, documents_total = property_repository.list_documents(
        db, property_id=property_id, skip=0, limit=DETAIL_PREVIEW_LIMIT
    )
    transactions, transactions_total = property_repository.list_transactions(
        db, property_id=property_id, skip=0, limit=DETAIL_PREVIEW_LIMIT
    )
    ownership, ownership_total = property_repository.list_ownership_history(
        db, property_id=property_id, skip=0, limit=DETAIL_PREVIEW_LIMIT
    )
    property_read = property_repository.enrich_properties(db, [row])[0]
    return PropertyDetailRead(
        **property_read.model_dump(),
        documents=documents,
        transactions=property_repository.enrich_transactions(db, transactions),
        ownership_history=property_repository.enrich_ownership_rows(db, ownership),
        documents_total=documents_total,
        transactions_total=transactions_total,
        ownership_history_total=ownership_total,
    )


@router.get(
    "/{property_id}/documents",
    response_model=PaginatedPropertyDocuments,
)
def list_property_documents(
    property_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(HISTORY_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    if property_repository.get_property(db, property_id) is None:
        raise HTTPException(status_code=404, detail="Property not found")
    items, total = property_repository.list_documents(
        db, property_id=property_id, skip=skip, limit=limit
    )
    return PaginatedPropertyDocuments(items=items, total=total, skip=skip, limit=limit)


@router.get(
    "/{property_id}/transactions",
    response_model=PaginatedPropertyTransactions,
)
def list_property_transactions(
    property_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(HISTORY_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    if property_repository.get_property(db, property_id) is None:
        raise HTTPException(status_code=404, detail="Property not found")
    items, total = property_repository.list_transactions(
        db, property_id=property_id, skip=skip, limit=limit
    )
    return PaginatedPropertyTransactions(
        items=property_repository.enrich_transactions(db, items),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{property_id}/ownership-history",
    response_model=PaginatedOwnershipHistory,
)
def list_property_ownership_history(
    property_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(HISTORY_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    if property_repository.get_property(db, property_id) is None:
        raise HTTPException(status_code=404, detail="Property not found")
    items, total = property_repository.list_ownership_history(
        db,
        property_id=property_id,
        skip=skip,
        limit=limit,
        active_only=active_only,
    )
    return PaginatedOwnershipHistory(
        items=property_repository.enrich_ownership_rows(db, items),
        total=total,
        skip=skip,
        limit=limit,
    )
