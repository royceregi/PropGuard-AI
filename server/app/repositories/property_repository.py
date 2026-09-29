from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.property import (
    Property,
    PropertyDocument,
    PropertyOwnershipHistory,
    PropertyTransaction,
    TransactionParty,
)
from app.models.user import User
from app.schemas.property import (
    LinkedUserSummary,
    PropertyOwnershipHistoryRead,
    PropertyRead,
    PropertyTransactionDetailRead,
    PropertyTransactionRead,
    TransactionPartyRead,
    UserRelatedProperty,
)


def get_property(db: Session, property_id: str) -> Property | None:
    return db.query(Property).filter(Property.property_id == property_id).first()


def accessible_property_ids_for_user(db: Session, user_id: str) -> set[str]:
    """Owned, ownership-history, or transaction-party (shared) property IDs."""
    owned_ids, history_ids, party_ids = property_access_sets(db, user_id)
    return owned_ids | history_ids | party_ids


def property_access_sets(
    db: Session, user_id: str
) -> tuple[set[str], set[str], set[str]]:
    """(current-owner IDs, ownership-history IDs, transaction-party IDs) for a user."""
    if not user_id:
        return set(), set(), set()

    owned_ids = {
        row[0]
        for row in db.query(Property.property_id)
        .filter(Property.current_owner_id == user_id)
        .all()
        if row[0]
    }
    history_ids = {
        row[0]
        for row in db.query(PropertyOwnershipHistory.property_id)
        .filter(PropertyOwnershipHistory.owner_id == user_id)
        .distinct()
        .all()
        if row[0]
    }
    party_ids = {
        row[0]
        for row in db.query(PropertyTransaction.property_id)
        .join(
            TransactionParty,
            TransactionParty.transaction_id == PropertyTransaction.transaction_id,
        )
        .filter(TransactionParty.user_id == user_id)
        .distinct()
        .all()
        if row[0]
    }
    return owned_ids, history_ids, party_ids


def user_can_access_property(db: Session, user_id: str, property_id: str) -> bool:
    if not user_id or not property_id:
        return False

    prop = get_property(db, property_id)
    if prop is None:
        return False
    if prop.current_owner_id == user_id:
        return True

    history_hit = (
        db.query(PropertyOwnershipHistory.ownership_id)
        .filter(
            PropertyOwnershipHistory.property_id == property_id,
            PropertyOwnershipHistory.owner_id == user_id,
        )
        .first()
    )
    if history_hit is not None:
        return True

    party_hit = (
        db.query(TransactionParty.transaction_party_id)
        .join(
            PropertyTransaction,
            PropertyTransaction.transaction_id == TransactionParty.transaction_id,
        )
        .filter(
            PropertyTransaction.property_id == property_id,
            TransactionParty.user_id == user_id,
        )
        .first()
    )
    return party_hit is not None


def user_can_access_transaction(
    db: Session, user_id: str, transaction_id: str
) -> bool:
    if not user_id or not transaction_id:
        return False

    party_hit = (
        db.query(TransactionParty.transaction_party_id)
        .filter(
            TransactionParty.transaction_id == transaction_id,
            TransactionParty.user_id == user_id,
        )
        .first()
    )
    if party_hit is not None:
        return True

    tx = get_transaction(db, transaction_id)
    if tx is None or not tx.property_id:
        return False
    return user_can_access_property(db, user_id, tx.property_id)


def list_properties(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    q: str | None = None,
    district: str | None = None,
    city: str | None = None,
    land_type: str | None = None,
    usage_type: str | None = None,
    verification_status: str | None = None,
    legal_status: str | None = None,
    property_ids: set[str] | None = None,
) -> tuple[list[Property], int]:
    query = db.query(Property)

    if property_ids is not None:
        if not property_ids:
            return [], 0
        query = query.filter(Property.property_id.in_(property_ids))

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Property.property_id.ilike(pattern),
                Property.property_name.ilike(pattern),
                Property.title_deed_number.ilike(pattern),
                Property.address.ilike(pattern),
                Property.survey_plan_number.ilike(pattern),
                Property.current_owner_id.ilike(pattern),
            )
        )
    if district:
        query = query.filter(Property.district.ilike(district.strip()))
    if city:
        query = query.filter(Property.city.ilike(city.strip()))
    if land_type:
        query = query.filter(Property.land_type.ilike(land_type.strip()))
    if usage_type:
        query = query.filter(Property.current_usage_type.ilike(usage_type.strip()))
    if verification_status:
        query = query.filter(
            Property.verification_status.ilike(verification_status.strip())
        )
    if legal_status:
        query = query.filter(Property.legal_status.ilike(legal_status.strip()))

    total = query.with_entities(func.count(Property.property_id)).scalar() or 0
    items = (
        query.order_by(Property.updated_at.desc().nullslast(), Property.property_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, int(total)


def get_document(db: Session, document_id: int) -> PropertyDocument | None:
    return (
        db.query(PropertyDocument)
        .filter(PropertyDocument.document_id == document_id)
        .first()
    )


def list_documents(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    property_id: str | None = None,
    transaction_id: str | None = None,
    document_type: str | None = None,
    verification_status: str | None = None,
    property_ids: set[str] | None = None,
) -> tuple[list[PropertyDocument], int]:
    query = db.query(PropertyDocument)

    if property_ids is not None:
        if not property_ids:
            return [], 0
        query = query.filter(PropertyDocument.property_id.in_(property_ids))
    if property_id:
        query = query.filter(PropertyDocument.property_id == property_id)
    if transaction_id:
        query = query.filter(PropertyDocument.transaction_id == transaction_id)
    if document_type:
        query = query.filter(
            PropertyDocument.document_type.ilike(document_type.strip())
        )
    if verification_status:
        query = query.filter(
            PropertyDocument.verification_status.ilike(verification_status.strip())
        )

    total = query.with_entities(func.count(PropertyDocument.document_id)).scalar() or 0
    items = (
        query.order_by(
            PropertyDocument.issued_date.desc().nullslast(),
            PropertyDocument.document_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, int(total)


def get_ownership(db: Session, ownership_id: int) -> PropertyOwnershipHistory | None:
    return (
        db.query(PropertyOwnershipHistory)
        .filter(PropertyOwnershipHistory.ownership_id == ownership_id)
        .first()
    )


def list_ownership_history(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    property_id: str | None = None,
    owner_id: str | None = None,
    ownership_status: str | None = None,
    active_only: bool = False,
    property_ids: set[str] | None = None,
) -> tuple[list[PropertyOwnershipHistory], int]:
    query = db.query(PropertyOwnershipHistory)

    if property_ids is not None:
        if not property_ids:
            return [], 0
        query = query.filter(PropertyOwnershipHistory.property_id.in_(property_ids))
    if property_id:
        query = query.filter(PropertyOwnershipHistory.property_id == property_id)
    if owner_id:
        query = query.filter(PropertyOwnershipHistory.owner_id == owner_id)
    if ownership_status:
        query = query.filter(
            PropertyOwnershipHistory.ownership_status.ilike(ownership_status.strip())
        )
    if active_only:
        query = query.filter(
            PropertyOwnershipHistory.ownership_end_date.is_(None),
            PropertyOwnershipHistory.ownership_status.ilike("ACTIVE"),
        )

    total = (
        query.with_entities(func.count(PropertyOwnershipHistory.ownership_id)).scalar()
        or 0
    )
    items = (
        query.order_by(
            PropertyOwnershipHistory.ownership_start_date.desc().nullslast(),
            PropertyOwnershipHistory.ownership_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, int(total)


def get_transaction(db: Session, transaction_id: str) -> PropertyTransaction | None:
    return (
        db.query(PropertyTransaction)
        .filter(PropertyTransaction.transaction_id == transaction_id)
        .first()
    )


def list_transactions(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    q: str | None = None,
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
    property_ids: set[str] | None = None,
) -> tuple[list[PropertyTransaction], int]:
    query = db.query(PropertyTransaction)

    if property_ids is not None:
        if not property_ids:
            return [], 0
        query = query.filter(PropertyTransaction.property_id.in_(property_ids))
    if transaction_id:
        query = query.filter(
            PropertyTransaction.transaction_id.ilike(f"%{transaction_id.strip()}%")
        )
    if property_id:
        query = query.filter(PropertyTransaction.property_id == property_id)
    if status:
        query = query.filter(PropertyTransaction.status.ilike(status.strip()))
    if registration_type:
        query = query.filter(
            PropertyTransaction.registration_type.ilike(registration_type.strip())
        )
    if transaction_group:
        query = query.filter(
            PropertyTransaction.transaction_group.ilike(transaction_group.strip())
        )
    if area_name:
        query = query.filter(PropertyTransaction.area_name.ilike(area_name.strip()))
    if project_name:
        query = query.filter(
            PropertyTransaction.project_name.ilike(f"%{project_name.strip()}%")
        )
    if date_from:
        query = query.filter(
            func.date(PropertyTransaction.transaction_datetime) >= date_from
        )
    if date_to:
        query = query.filter(
            func.date(PropertyTransaction.transaction_datetime) <= date_to
        )
    if min_value is not None:
        query = query.filter(PropertyTransaction.transaction_value >= min_value)
    if max_value is not None:
        query = query.filter(PropertyTransaction.transaction_value <= max_value)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                PropertyTransaction.transaction_id.ilike(pattern),
                PropertyTransaction.property_id.ilike(pattern),
                PropertyTransaction.procedure_name.ilike(pattern),
                PropertyTransaction.registration_type.ilike(pattern),
                PropertyTransaction.transaction_group.ilike(pattern),
                PropertyTransaction.area_name.ilike(pattern),
                PropertyTransaction.project_name.ilike(pattern),
            )
        )

    total = (
        query.with_entities(func.count(PropertyTransaction.transaction_id)).scalar()
        or 0
    )
    items = (
        query.order_by(
            PropertyTransaction.transaction_datetime.desc().nullslast(),
            PropertyTransaction.transaction_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items, int(total)


def _user_summary(user: User | None) -> LinkedUserSummary | None:
    if user is None:
        return None
    return LinkedUserSummary.model_validate(user)


def get_linked_user(db: Session, user_id: str | None) -> LinkedUserSummary | None:
    if not user_id:
        return None
    user = db.query(User).filter(User.user_id == user_id).first()
    return _user_summary(user)


def get_users_by_ids(
    db: Session, user_ids: list[str] | set[str]
) -> dict[str, LinkedUserSummary]:
    ids = [uid for uid in {*(user_ids or [])} if uid]
    if not ids:
        return {}
    rows = db.query(User).filter(User.user_id.in_(ids)).all()
    return {row.user_id: LinkedUserSummary.model_validate(row) for row in rows}


def _normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def _pick_party(
    parties: list[TransactionPartyRead], *roles: str
) -> TransactionPartyRead | None:
    wanted = {role.upper() for role in roles}
    primary = next(
        (
            party
            for party in parties
            if _normalize_role(party.role) in wanted and party.is_primary
        ),
        None,
    )
    if primary is not None:
        return primary
    return next(
        (party for party in parties if _normalize_role(party.role) in wanted),
        None,
    )


def serialize_party(
    party: TransactionParty, user: LinkedUserSummary | None = None
) -> TransactionPartyRead:
    return TransactionPartyRead(
        transaction_party_id=party.transaction_party_id,
        transaction_id=party.transaction_id,
        user_id=party.user_id,
        party_name=party.party_name,
        role=party.role,
        is_primary=party.is_primary,
        user=user,
    )


def list_transaction_parties(
    db: Session, transaction_id: str
) -> list[TransactionPartyRead]:
    rows = (
        db.query(TransactionParty)
        .filter(TransactionParty.transaction_id == transaction_id)
        .order_by(
            TransactionParty.is_primary.desc().nullslast(),
            TransactionParty.transaction_party_id,
        )
        .all()
    )
    users = get_users_by_ids(db, [row.user_id for row in rows if row.user_id])
    return [
        serialize_party(row, users.get(row.user_id) if row.user_id else None)
        for row in rows
    ]


def list_parties_for_transactions(
    db: Session, transaction_ids: list[str]
) -> dict[str, list[TransactionPartyRead]]:
    ids = [tid for tid in transaction_ids if tid]
    if not ids:
        return {}

    rows = (
        db.query(TransactionParty)
        .filter(TransactionParty.transaction_id.in_(ids))
        .order_by(
            TransactionParty.is_primary.desc().nullslast(),
            TransactionParty.transaction_party_id,
        )
        .all()
    )
    users = get_users_by_ids(db, [row.user_id for row in rows if row.user_id])
    grouped: dict[str, list[TransactionPartyRead]] = {tid: [] for tid in ids}
    for row in rows:
        if not row.transaction_id:
            continue
        grouped.setdefault(row.transaction_id, []).append(
            serialize_party(row, users.get(row.user_id) if row.user_id else None)
        )
    return grouped


def serialize_property(
    prop: Property, current_owner: LinkedUserSummary | None = None
) -> PropertyRead:
    data = PropertyRead.model_validate(prop)
    if current_owner is not None:
        return data.model_copy(update={"current_owner": current_owner})
    return data


def serialize_ownership(
    row: PropertyOwnershipHistory, owner: LinkedUserSummary | None = None
) -> PropertyOwnershipHistoryRead:
    data = PropertyOwnershipHistoryRead.model_validate(row)
    if owner is not None:
        return data.model_copy(update={"owner": owner})
    return data


def serialize_transaction(
    row: PropertyTransaction,
    *,
    parties: list[TransactionPartyRead] | None = None,
) -> PropertyTransactionRead:
    party_list = parties or []
    # Dataset uses Owner for the acquiring party; Buyer is the preferred alias.
    buyer = _pick_party(party_list, "BUYER", "OWNER")
    seller = _pick_party(party_list, "SELLER")
    data = PropertyTransactionRead.model_validate(row)
    return data.model_copy(update={"buyer": buyer, "seller": seller})


def enrich_properties(db: Session, properties: list[Property]) -> list[PropertyRead]:
    owners = get_users_by_ids(
        db, [prop.current_owner_id for prop in properties if prop.current_owner_id]
    )
    return [
        serialize_property(
            prop,
            owners.get(prop.current_owner_id) if prop.current_owner_id else None,
        )
        for prop in properties
    ]


def enrich_ownership_rows(
    db: Session, rows: list[PropertyOwnershipHistory]
) -> list[PropertyOwnershipHistoryRead]:
    owners = get_users_by_ids(db, [row.owner_id for row in rows if row.owner_id])
    return [
        serialize_ownership(row, owners.get(row.owner_id) if row.owner_id else None)
        for row in rows
    ]


def enrich_transactions(
    db: Session, rows: list[PropertyTransaction]
) -> list[PropertyTransactionRead]:
    parties_by_tx = list_parties_for_transactions(
        db, [row.transaction_id for row in rows]
    )
    return [
        serialize_transaction(row, parties=parties_by_tx.get(row.transaction_id, []))
        for row in rows
    ]


def get_transaction_detail(
    db: Session, transaction_id: str
) -> PropertyTransactionDetailRead | None:
    row = get_transaction(db, transaction_id)
    if row is None:
        return None

    parties = list_transaction_parties(db, transaction_id)
    base = serialize_transaction(row, parties=parties)

    prop = get_property(db, row.property_id) if row.property_id else None
    current_owner = (
        get_linked_user(db, prop.current_owner_id) if prop is not None else None
    )
    property_read = (
        serialize_property(prop, current_owner) if prop is not None else None
    )

    seller_id = base.seller.user_id if base.seller else None
    owner_id = prop.current_owner_id if prop is not None else None
    seller_matches = (
        bool(seller_id and owner_id and seller_id == owner_id)
        if seller_id or owner_id
        else None
    )

    return PropertyTransactionDetailRead(
        **base.model_dump(),
        parties=parties,
        property=property_read,
        current_owner=current_owner,
        seller_matches_current_owner=seller_matches,
    )


def list_properties_for_user(
    db: Session,
    user_id: str,
    *,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[UserRelatedProperty], int]:
    """Properties linked via current owner, ownership history, or transaction parties."""
    if not user_id:
        return [], 0

    owned_ids = {
        row[0]
        for row in db.query(Property.property_id)
        .filter(Property.current_owner_id == user_id)
        .all()
        if row[0]
    }
    history_ids = {
        row[0]
        for row in db.query(PropertyOwnershipHistory.property_id)
        .filter(PropertyOwnershipHistory.owner_id == user_id)
        .distinct()
        .all()
        if row[0]
    }
    party_rows = (
        db.query(PropertyTransaction.property_id, TransactionParty.role)
        .join(
            TransactionParty,
            TransactionParty.transaction_id == PropertyTransaction.transaction_id,
        )
        .filter(TransactionParty.user_id == user_id)
        .all()
    )
    party_ids: set[str] = set()
    roles_by_property: dict[str, set[str]] = {}
    for property_id, role in party_rows:
        if not property_id:
            continue
        party_ids.add(property_id)
        roles_by_property.setdefault(property_id, set())
        if role and str(role).strip():
            roles_by_property[property_id].add(str(role).strip())

    all_ids = owned_ids | history_ids | party_ids
    if not all_ids:
        return [], 0

    total = len(all_ids)
    props = (
        db.query(Property)
        .filter(Property.property_id.in_(all_ids))
        .order_by(Property.updated_at.desc().nullslast(), Property.property_id)
        .offset(skip)
        .limit(limit)
        .all()
    )

    items: list[UserRelatedProperty] = []
    for prop in props:
        pid = prop.property_id
        base = PropertyRead.model_validate(prop)
        items.append(
            UserRelatedProperty(
                **base.model_dump(),
                is_current_owner=pid in owned_ids,
                in_ownership_history=pid in history_ids,
                in_transactions=pid in party_ids,
                party_roles=sorted(roles_by_property.get(pid, set())),
            )
        )
    return items, total
