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
from app.schemas.blockchain_hash import (
    HashVerifyResponse,
    PaginatedBlockchainHashDetails,
    RegistryChecksResponse,
)
from app.services import blockchain_hash_service, registry_checks_service

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC", "STANDARD"]


@router.get("/hash-details", response_model=PaginatedBlockchainHashDetails)
def list_hash_details(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, description="Search tx id, property id, hashes"),
    property_id: str | None = None,
    transaction_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    allowed_ids = scoped_property_ids(db, current_user)
    if property_id:
        ensure_property_access(db, current_user, property_id)
    if transaction_id:
        ensure_transaction_access(db, current_user, transaction_id)

    try:
        blockchain_hash_service.ensure_hash_details_view(db)
    except Exception:
        db.rollback()

    try:
        items, total = blockchain_hash_service.list_hash_details(
            db,
            skip=skip,
            limit=limit,
            q=q,
            property_id=property_id,
            transaction_id=transaction_id,
            property_ids=allowed_ids,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to read hash details. Ensure the view exists "
                f"(run sql/003_blockchain_hash_details_view.sql): {exc}"
            ),
        ) from exc

    return PaginatedBlockchainHashDetails(items=items, total=total, skip=skip, limit=limit)


@router.get("/verify/{transaction_id}", response_model=HashVerifyResponse)
def verify_transaction_hashes(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_transaction_access(db, current_user, transaction_id)
    result = blockchain_hash_service.verify_transaction(db, transaction_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Blockchain transaction not found")
    return result


@router.get("/checks/{transaction_id}", response_model=RegistryChecksResponse)
def registry_checks(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    """Legal / business checks: wallets, ownership, parties, encumbrance, registration."""
    ensure_transaction_access(db, current_user, transaction_id)
    result = registry_checks_service.run_checks(db, transaction_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return result
