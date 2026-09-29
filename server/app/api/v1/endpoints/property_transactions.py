from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.property_access import (
    ensure_property_access,
    ensure_transaction_access,
    scoped_property_ids,
)
from app.core.database import get_db
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.property import (
    PaginatedPropertyTransactions,
    PropertyTransactionDetailRead,
)

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]


@router.get("/", response_model=PaginatedPropertyTransactions)
def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, description="Search transaction / property / procedure"),
    property_id: str | None = None,
    transaction_id: str | None = None,
    status: str | None = None,
    registration_type: str | None = None,
    transaction_group: str | None = None,
    area_name: str | None = None,
    project_name: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_value: Decimal | None = None,
    max_value: Decimal | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    allowed_ids = scoped_property_ids(db, current_user)
    if property_id:
        ensure_property_access(db, current_user, property_id)

    items, total = property_repository.list_transactions(
        db,
        skip=skip,
        limit=limit,
        q=q,
        property_id=property_id,
        transaction_id=transaction_id,
        status=status,
        registration_type=registration_type,
        transaction_group=transaction_group,
        area_name=area_name,
        project_name=project_name,
        date_from=date_from,
        date_to=date_to,
        min_value=min_value,
        max_value=max_value,
        property_ids=allowed_ids,
    )
    return PaginatedPropertyTransactions(
        items=property_repository.enrich_transactions(db, items),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{transaction_id}", response_model=PropertyTransactionDetailRead)
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_transaction_access(db, current_user, transaction_id)
    detail = property_repository.get_transaction_detail(db, transaction_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return detail
