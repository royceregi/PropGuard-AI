"""Phase 8a — Property Sharing API Endpoints (08-roles-and-permissions.md & 11-implementation-phases.md).

Allows property owners (sellers) to send read-only access for a property to a prospective buyer.
Buyers can view received shares in their inbox and inspect the property details before a deal.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.api.property_access import is_public_viewer
from app.core.database import get_db
from app.models.property import Property, PropertyShare
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.schemas.property_share import PropertyShareCreate

router = APIRouter()

# Super Admin and Land Registry neither own nor receive properties, so sharing is not for them.
SHARE_ROLES = ["COMPANY", "PUBLIC"]


def _serialize_property(prop: Property | None) -> dict[str, Any] | None:
    if prop is None or not getattr(prop, "property_id", None):
        return None
    return {
        "property_id": getattr(prop, "property_id", None),
        "property_name": getattr(prop, "property_name", None),
        "address": getattr(prop, "address", None),
        "city": getattr(prop, "city", None),
        "district": getattr(prop, "district", None),
        "title_deed_number": getattr(prop, "title_deed_number", None),
    }


def _serialize_share(db: Session, share: PropertyShare) -> dict[str, Any]:
    now = datetime.now()
    active = share.revoked_at is None and (share.expires_at is None or share.expires_at > now)

    prop = db.query(Property).filter(Property.property_id == share.property_id).first()
    owner = db.query(UserModel).filter(UserModel.user_id == share.owner_user_id).first()
    buyer = db.query(UserModel).filter(UserModel.user_id == share.buyer_user_id).first()

    prop_data = _serialize_property(prop)

    owner_data = None
    if owner and getattr(owner, "user_id", None):
        fn = getattr(owner, "first_name", "") or ""
        ln = getattr(owner, "last_name", "") or ""
        un = getattr(owner, "username", "") or ""
        owner_data = {
            "user_id": getattr(owner, "user_id", None),
            "name": f"{fn} {ln}".strip() or un,
            "email": getattr(owner, "email", None),
        }

    buyer_data = None
    if buyer and getattr(buyer, "user_id", None):
        fn = getattr(buyer, "first_name", "") or ""
        ln = getattr(buyer, "last_name", "") or ""
        un = getattr(buyer, "username", "") or ""
        buyer_data = {
            "user_id": getattr(buyer, "user_id", None),
            "name": f"{fn} {ln}".strip() or un,
            "email": getattr(buyer, "email", None),
        }

    return {
        "share_id": share.share_id,
        "property_id": share.property_id,
        "owner_user_id": share.owner_user_id,
        "buyer_user_id": share.buyer_user_id,
        "notes": share.notes,
        "created_at": share.created_at.isoformat() if share.created_at else None,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "revoked_at": share.revoked_at.isoformat() if share.revoked_at else None,
        "is_active": active,
        "property": prop_data,
        "owner": owner_data,
        "buyer": buyer_data,
    }


@router.post("/properties/{property_id}/shares", response_model=dict[str, Any])
def share_property_with_buyer(
    property_id: str,
    payload: PropertyShareCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(SHARE_ROLES)),
):
    """Current property owner (seller) shares property details read-only with a buyer."""
    prop = db.query(Property).filter(Property.property_id == property_id.strip()).first()
    if prop is None or not getattr(prop, "property_id", None):
        raise HTTPException(status_code=404, detail="Property not found")

    # Access check: public users must be the current owner
    if (
        is_public_viewer(current_user)
        and getattr(prop, "current_owner_id", None) != current_user.user_id
    ):
        raise HTTPException(
            status_code=403, detail="Only the current property owner can share this property"
        )

    target_ident = payload.buyer_user_id.strip()
    buyer = (
        db.query(UserModel)
        .filter(
            or_(
                UserModel.user_id == target_ident,
                UserModel.email == target_ident.lower(),
                UserModel.username == target_ident,
            )
        )
        .first()
    )
    if buyer is None or not getattr(buyer, "user_id", None):
        raise HTTPException(
            status_code=404,
            detail=f"Target buyer '{target_ident}' not found by User ID, email, or username",
        )

    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.now() + timedelta(days=payload.expires_in_days)

    share = PropertyShare(
        share_id=f"SHR-{uuid.uuid4().hex[:8].upper()}",
        property_id=prop.property_id,
        owner_user_id=current_user.user_id,
        buyer_user_id=buyer.user_id,
        notes=payload.notes,
        created_at=datetime.now(),
        expires_at=expires_at,
        revoked_at=None,
    )
    db.add(share)
    db.commit()
    db.refresh(share)

    # Dispatch Notification (Phase 10)
    from app.services import notification_service

    owner_name = getattr(current_user, "username", current_user.user_id)
    prop_name = getattr(prop, "property_name", prop.property_id)
    notification_service.notify_property_shared(
        db,
        owner_name=owner_name,
        buyer_user_id=buyer.user_id,
        property_id=prop.property_id,
        property_name=prop_name,
    )

    return _serialize_share(db, share)


@router.delete("/properties/{property_id}/shares/{share_id}", response_model=dict[str, Any])
def revoke_property_share(
    property_id: str,
    share_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(SHARE_ROLES)),
):
    """Revoke an active property share (its owner, or a company user)."""
    share = (
        db.query(PropertyShare)
        .filter(
            PropertyShare.share_id == share_id.strip(),
            PropertyShare.property_id == property_id.strip(),
        )
        .first()
    )

    if share is None or not getattr(share, "share_id", None):
        raise HTTPException(status_code=404, detail="Property share not found")

    if is_public_viewer(current_user) and share.owner_user_id != current_user.user_id:
        raise HTTPException(
            status_code=403, detail="Only the owner who created the share can revoke it"
        )

    share.revoked_at = datetime.now()
    db.commit()
    db.refresh(share)

    # Dispatch Notification (Phase 10)
    from app.services import notification_service

    prop = db.query(Property).filter(Property.property_id == property_id.strip()).first()
    prop_name = getattr(prop, "property_name", property_id) if prop else property_id
    notification_service.notify_share_revoked(
        db,
        buyer_user_id=share.buyer_user_id,
        property_id=property_id,
        property_name=prop_name,
    )

    return _serialize_share(db, share)


@router.get("/shares/received", response_model=list[dict[str, Any]])
def received_shares_inbox(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(SHARE_ROLES)),
):
    """Buyer's inbox: properties shared with current user."""
    query = db.query(PropertyShare).filter(PropertyShare.buyer_user_id == current_user.user_id)
    if active_only:
        now = datetime.now()
        query = query.filter(
            PropertyShare.revoked_at.is_(None),
            or_(PropertyShare.expires_at.is_(None), PropertyShare.expires_at > now),
        )
    shares = query.order_by(PropertyShare.created_at.desc()).all()
    return [_serialize_share(db, s) for s in shares]


@router.get("/shares/linked", response_model=list[dict[str, Any]])
def linked_properties(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(SHARE_ROLES)),
):
    """Properties the user can see without owning or an explicit share.

    Mirrors the SHARED access used by risk analysis: previous ownership or being a
    transaction party. Properties already explicitly shared are left to /shares/received.
    """
    user_id = current_user.user_id
    owned, history, party = property_repository.property_access_sets(db, user_id)
    explicit = property_repository.active_shared_property_ids_for_user(db, user_id)
    linked_ids = (history | party) - owned - explicit
    if not linked_ids:
        return []

    props = db.query(Property).filter(Property.property_id.in_(linked_ids)).all()
    rows = []
    for prop in props:
        reasons = []
        if prop.property_id in history:
            reasons.append("PREVIOUS_OWNER")
        if prop.property_id in party:
            reasons.append("TRANSACTION_PARTY")
        rows.append(
            {
                "property_id": prop.property_id,
                "property": _serialize_property(prop),
                "reasons": reasons,
            }
        )
    rows.sort(key=lambda row: row["property_id"])
    return rows


@router.get("/shares/sent", response_model=list[dict[str, Any]])
def sent_shares_outbox(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(SHARE_ROLES)),
):
    """Seller's outbox: property shares created by current user."""
    shares = (
        db.query(PropertyShare)
        .filter(PropertyShare.owner_user_id == current_user.user_id)
        .order_by(PropertyShare.created_at.desc())
        .all()
    )
    return [_serialize_share(db, s) for s in shares]
