from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.hashing import (
    compute_transaction_data_hash,
)
from app.models.property import BlockchainTransaction, PropertyTransaction
from app.services.blockchain_hash_service import transaction_data_hash_for


def explorer_url_for(tx_hash: str | None) -> str | None:
    if not tx_hash:
        return None
    digest = tx_hash if tx_hash.startswith("0x") else f"0x{tx_hash}"
    return f"https://etherscan.io/tx/{digest}"


def payload_hash_for(
    *,
    property_id: str | None,
    seller_address: str | None,
    buyer_address: str | None,
    value_usd: str | None | Decimal,
    currency: str | None,
    transaction_id: str | None = None,
    transaction_type: str | None = None,
    transaction_datetime: Any = None,
    property_hash: str | None = None,
) -> str:
    """Backward-compatible alias for transaction_data_hash over ledger fields."""
    return compute_transaction_data_hash(
        transaction_id=transaction_id,
        property_id=property_id,
        transaction_type=transaction_type,
        transaction_datetime=transaction_datetime,
        transaction_value=value_usd,
        currency=currency,
        from_wallet=seller_address,
        to_wallet=buyer_address,
        property_hash=property_hash,
    )


def _resolved_property_id(
    row: BlockchainTransaction, linked: PropertyTransaction | None
) -> str | None:
    if row.property_id and str(row.property_id).strip():
        return str(row.property_id).strip()
    if linked and linked.property_id:
        return str(linked.property_id).strip()
    return None


def _resolved_currency(row: BlockchainTransaction, linked: PropertyTransaction | None) -> str:
    if linked and linked.currency and str(linked.currency).strip():
        return str(linked.currency).strip().upper()
    return "AED"


def enrich_ledger_row(db: Session, row: BlockchainTransaction) -> dict[str, Any]:
    linked = None
    if row.transaction_id:
        linked = (
            db.query(PropertyTransaction)
            .filter(PropertyTransaction.transaction_id == row.transaction_id)
            .first()
        )

    property_id = _resolved_property_id(row, linked)
    currency = _resolved_currency(row, linked)
    value = row.transaction_value
    if value is None and linked is not None:
        value = linked.transaction_value

    recomputed_data_hash = transaction_data_hash_for(row, linked)

    previous_hash_valid = None
    if row.previous_hash and row.transaction_id:
        previous = (
            db.query(BlockchainTransaction)
            .filter(BlockchainTransaction.tx_hash == row.previous_hash)
            .first()
        )
        previous_hash_valid = previous is not None

    return {
        "blockchain_tx_id": row.blockchain_tx_id,
        "transaction_id": row.transaction_id,
        "property_id": property_id,
        "tx_hash": row.tx_hash,
        "previous_hash": row.previous_hash,
        "property_hash": row.property_hash,
        "block_number": row.block_number,
        "block_timestamp": row.block_timestamp,
        "from_wallet": row.from_wallet,
        "to_wallet": row.to_wallet,
        "transaction_type": row.transaction_type,
        "transaction_value": value,
        "currency": currency,
        "smart_contract_address": row.smart_contract_address,
        "digital_signature": row.digital_signature,
        "transaction_status": row.transaction_status,
        "consensus_verification": row.consensus_verification,
        "gas_fee": row.gas_fee,
        "created_at": row.created_at,
        "explorer_url": explorer_url_for(row.tx_hash),
        "payload_hash": recomputed_data_hash,
        "transaction_data_hash": row.transaction_data_hash,
        "previous_hash_valid": previous_hash_valid,
    }


def get_by_transaction_id(db: Session, transaction_id: str) -> dict[str, Any] | None:
    row = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.transaction_id == transaction_id.strip())
        .first()
    )
    if row is None:
        return None
    return enrich_ledger_row(db, row)


def get_latest_by_property_id(db: Session, property_id: str) -> dict[str, Any] | None:
    pid = property_id.strip()
    row = (
        db.query(BlockchainTransaction)
        .outerjoin(
            PropertyTransaction,
            PropertyTransaction.transaction_id == BlockchainTransaction.transaction_id,
        )
        .filter(
            or_(
                BlockchainTransaction.property_id == pid,
                PropertyTransaction.property_id == pid,
            )
        )
        .order_by(
            BlockchainTransaction.block_timestamp.desc().nullslast(),
            BlockchainTransaction.blockchain_tx_id.desc(),
        )
        .first()
    )
    if row is None:
        return None
    return enrich_ledger_row(db, row)


def list_ledger(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    property_id: str | None = None,
    transaction_id: str | None = None,
    q: str | None = None,
    property_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    query = db.query(BlockchainTransaction).outerjoin(
        PropertyTransaction,
        PropertyTransaction.transaction_id == BlockchainTransaction.transaction_id,
    )

    if property_ids is not None:
        if not property_ids:
            return [], 0
        query = query.filter(
            or_(
                BlockchainTransaction.property_id.in_(property_ids),
                PropertyTransaction.property_id.in_(property_ids),
            )
        )
    if property_id and property_id.strip():
        pid = property_id.strip()
        query = query.filter(
            or_(
                BlockchainTransaction.property_id == pid,
                PropertyTransaction.property_id == pid,
            )
        )
    if transaction_id and transaction_id.strip():
        query = query.filter(BlockchainTransaction.transaction_id == transaction_id.strip())
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                BlockchainTransaction.transaction_id.ilike(pattern),
                BlockchainTransaction.property_id.ilike(pattern),
                BlockchainTransaction.tx_hash.ilike(pattern),
                BlockchainTransaction.from_wallet.ilike(pattern),
                BlockchainTransaction.to_wallet.ilike(pattern),
                PropertyTransaction.property_id.ilike(pattern),
            )
        )

    total = query.with_entities(func.count(BlockchainTransaction.blockchain_tx_id)).scalar() or 0
    rows = (
        query.order_by(
            BlockchainTransaction.block_timestamp.desc().nullslast(),
            BlockchainTransaction.blockchain_tx_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [enrich_ledger_row(db, row) for row in rows], int(total)
