from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.property import PaginatedPropertyDocuments, PropertyDocumentRead

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY"]


@router.get("/", response_model=PaginatedPropertyDocuments)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    property_id: str | None = None,
    transaction_id: str | None = None,
    document_type: str | None = None,
    verification_status: str | None = None,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    items, total = property_repository.list_documents(
        db,
        skip=skip,
        limit=limit,
        property_id=property_id,
        transaction_id=transaction_id,
        document_type=document_type,
        verification_status=verification_status,
    )
    return PaginatedPropertyDocuments(
        items=items, total=total, skip=skip, limit=limit
    )


@router.get("/{document_id}", response_model=PropertyDocumentRead)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    row = property_repository.get_document(db, document_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return row
