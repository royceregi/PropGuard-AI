from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User as UserModel
from app.schemas.blockchain_hash import (
    HashClearResponse,
    HashRebuildResponse,
    HashRegenerateResponse,
)
from app.services import blockchain_hash_service

router = APIRouter()

ADMIN_ROLES = ["SYSTEM"]


def _prepare_schema(db: Session) -> None:
    try:
        blockchain_hash_service.ensure_tx_hash_nullable(db)
    except Exception:
        db.rollback()
    try:
        blockchain_hash_service.ensure_hash_details_view(db)
    except Exception:
        db.rollback()


@router.post("/rebuild-hashes", response_model=HashRebuildResponse)
def rebuild_blockchain_hashes(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    """Clear then regenerate ledger hashes in a single DB transaction."""
    _prepare_schema(db)
    try:
        result = blockchain_hash_service.rebuild_hashes(db)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Hash rebuild failed and was rolled back: {exc}",
        ) from exc

    return HashRebuildResponse(
        cleared=result["cleared"],
        total=result["total"],
        success=result["success"],
        failed=result["failed"],
    )


@router.post("/clear-hashes", response_model=HashClearResponse)
def clear_blockchain_hashes(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    _prepare_schema(db)
    result = blockchain_hash_service.clear_hashes(db)
    return HashClearResponse(cleared=result["cleared"])


@router.post("/regenerate-hashes", response_model=HashRegenerateResponse)
def regenerate_blockchain_hashes(
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    _prepare_schema(db)
    try:
        result = blockchain_hash_service.regenerate_hashes(db)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Hash regeneration failed and was rolled back: {exc}",
        ) from exc

    return HashRegenerateResponse(
        total=result["total"],
        success=result["success"],
        failed=result["failed"],
    )
