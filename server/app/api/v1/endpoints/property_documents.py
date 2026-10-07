from __future__ import annotations

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
from app.schemas.property import PaginatedPropertyDocuments, PropertyDocumentRead

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]


@router.get("/", response_model=PaginatedPropertyDocuments)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    property_id: str | None = None,
    transaction_id: str | None = None,
    document_type: str | None = None,
    verification_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    allowed_ids = scoped_property_ids(db, current_user)
    if property_id:
        ensure_property_access(db, current_user, property_id)
    if transaction_id:
        ensure_transaction_access(db, current_user, transaction_id)

    items, total = property_repository.list_documents(
        db,
        skip=skip,
        limit=limit,
        property_id=property_id,
        transaction_id=transaction_id,
        document_type=document_type,
        verification_status=verification_status,
        property_ids=allowed_ids,
    )
    return PaginatedPropertyDocuments(items=items, total=total, skip=skip, limit=limit)


@router.get("/{document_id}", response_model=PropertyDocumentRead)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    row = property_repository.get_document(db, document_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    if row.property_id:
        ensure_property_access(db, current_user, row.property_id)
    elif row.transaction_id:
        ensure_transaction_access(db, current_user, row.transaction_id)
    return row
