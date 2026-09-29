from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.property_access import (
    ensure_property_access,
    ensure_transaction_access,
    is_authority_viewer,
    scoped_property_ids,
)
from app.core.database import get_db
from app.models.user import User as UserModel
from app.repositories import blockchain_repository
from app.schemas.blockchain import (
    BlockchainTransactionRead,
    BlockchainVerifyRequest,
    BlockchainVerifyResponse,
    PaginatedBlockchainTransactions,
    VerificationFormOptions,
)
from app.services import blockchain_verification_service

router = APIRouter()

VIEW_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC", "STANDARD"]
# Verification only reads records; buyers (PUBLIC) are limited to own or shared properties.
VERIFY_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
VERIFY_FORBIDDEN = "You can only verify properties you own or that were shared with you."


def _ensure_can_verify(db: Session, user: UserModel, property_id: str, transaction_id: str) -> None:
    """Same 403 whether the record is missing or not shared, so IDs can't be probed."""
    if is_authority_viewer(user):
        return
    try:
        ensure_property_access(db, user, property_id)
        ensure_transaction_access(db, user, transaction_id)
    except HTTPException as exc:
        raise HTTPException(status_code=403, detail=VERIFY_FORBIDDEN) from exc


@router.get("/", response_model=PaginatedBlockchainTransactions)
def list_blockchain_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    property_id: str | None = None,
    transaction_id: str | None = None,
    q: str | None = Query(None, description="Search tx id, property id, hash, wallet"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    allowed_ids = scoped_property_ids(db, current_user)
    if property_id:
        ensure_property_access(db, current_user, property_id)
    if transaction_id:
        ensure_transaction_access(db, current_user, transaction_id)

    items, total = blockchain_repository.list_ledger(
        db,
        skip=skip,
        limit=limit,
        property_id=property_id,
        transaction_id=transaction_id,
        q=q,
        property_ids=allowed_ids,
    )
    return PaginatedBlockchainTransactions(
        items=items, total=total, skip=skip, limit=limit
    )


@router.get("/form-options", response_model=VerificationFormOptions)
def get_verification_form_options(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(VERIFY_ROLES)),
):
    return blockchain_verification_service.form_options(db)


@router.post("/verify", response_model=BlockchainVerifyResponse)
def verify_against_records(
    payload: BlockchainVerifyRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VERIFY_ROLES)),
):
    """Compare entered property + transaction details with registry and ledger records (read-only)."""
    _ensure_can_verify(db, current_user, payload.property_id, payload.transaction_id)
    return blockchain_verification_service.compare_submission(db, payload.model_dump())


@router.get("/by-property/{property_id}", response_model=BlockchainTransactionRead)
def get_latest_by_property(
    property_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_property_access(db, current_user, property_id)
    row = blockchain_repository.get_latest_by_property_id(db, property_id)
    if row is None:
        raise HTTPException(
            status_code=404, detail="No blockchain ledger record for this property"
        )
    return row


@router.get("/{transaction_id}", response_model=BlockchainTransactionRead)
def get_by_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEW_ROLES)),
):
    ensure_transaction_access(db, current_user, transaction_id)
    row = blockchain_repository.get_by_transaction_id(db, transaction_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Blockchain transaction not found")
    return row
