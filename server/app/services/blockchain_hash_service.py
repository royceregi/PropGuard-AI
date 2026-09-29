"""Clear / regenerate / verify blockchain ledger hashes."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core import signing
from app.core.config import settings
from app.core.hashing import (
    GENESIS_PREVIOUS_HASH,
    PROPERTY_HASH_FIELDS,
    compute_document_hash,
    compute_transaction_data_hash,
    compute_tx_hash,
    hash_property_payload,
    is_genesis_previous,
    property_payload_from,
)
from app.models.property import (
    BlockchainTransaction,
    Property,
    PropertyDocument,
    PropertySnapshot,
    PropertyTransaction,
)


def transaction_data_hash_for(
    row: BlockchainTransaction,
    linked: PropertyTransaction | None,
) -> str:
    """
    Canonical transaction payload hash for a ledger row.
    Date and currency come from property_transactions (fallback: block_timestamp / empty);
    everything else, including the anchored property_hash, comes from the ledger row.
    """
    return compute_transaction_data_hash(
        transaction_id=row.transaction_id,
        property_id=row.property_id,
        transaction_type=row.transaction_type,
        transaction_datetime=(linked.transaction_datetime if linked else None)
        or row.block_timestamp,
        transaction_value=row.transaction_value,
        currency=linked.currency if linked else None,
        from_wallet=row.from_wallet,
        to_wallet=row.to_wallet,
        property_hash=row.property_hash,
    )


def _linked_transaction(
    db: Session, transaction_id: str | None
) -> PropertyTransaction | None:
    if not transaction_id or not str(transaction_id).strip():
        return None
    return (
        db.query(PropertyTransaction)
        .filter(PropertyTransaction.transaction_id == str(transaction_id).strip())
        .first()
    )


def clear_hashes(db: Session, *, commit: bool = True) -> dict[str, int]:
    """
    Safe reset of ledger hashes. Leaves document_hash untouched.
    tx_hash is set NULL (column must allow NULL; unique still ok for NULLs in PG).
    digital_signature is cleared only when a signing key can re-create it.
    """
    signature_reset = ", digital_signature = NULL" if signing.signing_enabled() else ""
    result = db.execute(
        text(
            f"""
            UPDATE core.blockchain_transactions
            SET
                previous_hash = NULL,
                property_hash = NULL,
                transaction_data_hash = NULL,
                tx_hash = NULL{signature_reset}
            """
        )
    )
    db.query(PropertySnapshot).delete(synchronize_session=False)
    if commit:
        db.commit()
    else:
        db.flush()
    return {"cleared": int(result.rowcount or 0)}


def _chain_sort_key(row: BlockchainTransaction) -> tuple:
    return (
        row.block_number if row.block_number is not None else 10**18,
        row.block_timestamp is None,
        row.block_timestamp or 0,
        row.blockchain_tx_id or 0,
    )


def regenerate_hashes(db: Session, *, commit: bool = True) -> dict[str, int]:
    """
    Ordered recalculation per property chain.
    All updates commit together; any hard failure rolls back everything.
    """
    rows = db.query(BlockchainTransaction).all()
    total = len(rows)

    properties = {
        p.property_id: p
        for p in db.query(Property).all()
        if p.property_id is not None
    }
    linked_by_tx = {
        t.transaction_id: t
        for t in db.query(PropertyTransaction).all()
        if t.transaction_id is not None
    }

    sign_blocks = signing.signing_enabled()

    def _link(row: BlockchainTransaction, previous: str, property_hash: str) -> str:
        row.previous_hash = previous
        row.property_hash = property_hash
        row.transaction_data_hash = transaction_data_hash_for(
            row, linked_by_tx.get(row.transaction_id)
        )
        row.tx_hash = compute_tx_hash(
            previous_hash=previous,
            transaction_data_hash=row.transaction_data_hash,
            block_timestamp=row.block_timestamp,
        )
        row.smart_contract_address = settings.REGISTRY_CONTRACT_ADDRESS
        if sign_blocks:
            row.digital_signature = signing.sign(row.tx_hash)
        return row.tx_hash

    by_property: dict[str, list[BlockchainTransaction]] = defaultdict(list)
    orphan: list[BlockchainTransaction] = []
    for row in rows:
        pid = (row.property_id or "").strip()
        if not pid:
            linked = linked_by_tx.get(row.transaction_id)
            pid = (linked.property_id or "").strip() if linked else ""
            if pid:
                row.property_id = pid
        if pid:
            by_property[pid].append(row)
        else:
            orphan.append(row)

    snapshots: dict[str, dict[str, Any]] = {}

    def _anchor(property_id: Any, source: Any) -> str:
        payload = property_payload_from(property_id, source)
        property_hash = hash_property_payload(payload)
        snapshots.setdefault(
            property_hash,
            {
                "property_hash": property_hash,
                "property_id": payload["property_id"] or None,
                "payload": payload,
            },
        )
        return property_hash

    try:
        success = 0
        for property_id, chain in by_property.items():
            chain.sort(key=_chain_sort_key)
            property_hash = _anchor(property_id, properties.get(property_id))
            previous = GENESIS_PREVIOUS_HASH
            for row in chain:
                previous = _link(row, previous, property_hash)
                success += 1

        orphan.sort(key=_chain_sort_key)
        for row in orphan:
            _link(row, GENESIS_PREVIOUS_HASH, _anchor(row.property_id, None))
            success += 1

        if snapshots:
            db.execute(
                pg_insert(PropertySnapshot)
                .values(list(snapshots.values()))
                .on_conflict_do_nothing(index_elements=["property_hash"])
            )

        if commit:
            db.commit()
        else:
            db.flush()
        return {"total": total, "success": success, "failed": 0}
    except Exception:
        db.rollback()
        raise


def rebuild_hashes(db: Session) -> dict[str, int]:
    """
    Clear then regenerate ledger hashes in a single transaction.
    document_hash is never touched.
    """
    try:
        cleared = clear_hashes(db, commit=False)["cleared"]
        regenerated = regenerate_hashes(db, commit=False)
        db.commit()
        return {
            "cleared": cleared,
            "total": regenerated["total"],
            "success": regenerated["success"],
            "failed": regenerated["failed"],
        }
    except Exception:
        db.rollback()
        raise


def check_documents(
    db: Session, transaction_id: str | None
) -> tuple[bool, list[dict[str, Any]]]:
    """Re-hash every document of a transaction. Documents without a stored hash are skipped."""
    if not transaction_id or not str(transaction_id).strip():
        return True, []
    docs = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.transaction_id == str(transaction_id).strip())
        .order_by(PropertyDocument.document_id.asc())
        .all()
    )
    results: list[dict[str, Any]] = []
    for doc in docs:
        stored = (doc.document_hash or "").strip()
        recomputed = compute_document_hash(doc.document_text) if stored else None
        results.append(
            {
                "document_id": doc.document_id,
                "document_type": doc.document_type,
                "document_number": doc.document_number,
                "document_hash": stored or None,
                "recomputed_document_hash": recomputed,
                "match": (recomputed == stored.lower()) if stored else None,
            }
        )
    return all(item["match"] is not False for item in results), results


def chain_context(db: Session, row: BlockchainTransaction) -> tuple[str, bool]:
    """(expected previous_hash, is_chain_head) for a ledger row within its property chain."""
    pid = (row.property_id or "").strip()
    if not pid:
        return GENESIS_PREVIOUS_HASH, True

    peers = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.property_id == pid)
        .all()
    )
    peers.sort(key=_chain_sort_key)
    for index, peer in enumerate(peers):
        if peer.blockchain_tx_id == row.blockchain_tx_id:
            expected = GENESIS_PREVIOUS_HASH if index == 0 else (peers[index - 1].tx_hash or "")
            return expected, index == len(peers) - 1
    return GENESIS_PREVIOUS_HASH, True


def check_property_anchor(
    db: Session,
    row: BlockchainTransaction,
    prop: Property | None,
    *,
    is_chain_head: bool,
) -> dict[str, Any]:
    """
    property_snapshot_match: stored property_hash == hash(anchored snapshot)  → snapshot not tampered
    property_current_match:  stored property_hash == hash(current registry)   → no change since anchoring
    property_hash_match:     snapshot intact, and (for the chain head only) registry unchanged.
    Older blocks may legitimately differ from the current registry; the head block may not.
    Without a snapshot (not rebuilt yet) it falls back to the current-registry comparison.
    """
    current_payload = property_payload_from(row.property_id, prop)
    current_hash = hash_property_payload(current_payload)
    stored = (row.property_hash or "").strip().lower()

    snapshot = db.get(PropertySnapshot, stored) if stored else None
    snapshot_match = snapshot is not None and hash_property_payload(snapshot.payload) == stored
    current_match = bool(stored) and stored == current_hash

    if snapshot is None:
        property_hash_match = current_match
    else:
        property_hash_match = snapshot_match and (current_match or not is_chain_head)

    changes: list[dict[str, Any]] = []
    if snapshot is not None and not current_match:
        changes = [
            {
                "field": field,
                "anchored": snapshot.payload.get(field),
                "current": current_payload.get(field),
            }
            for field in PROPERTY_HASH_FIELDS
            if snapshot.payload.get(field) != current_payload.get(field)
        ]

    return {
        "property_hash_match": property_hash_match,
        "property_snapshot_match": snapshot_match,
        "property_current_match": current_match,
        "snapshot_found": snapshot is not None,
        "recomputed_property_hash": current_hash,
        "property_changes": changes,
    }


def check_ledger_authenticity(db: Session, row: BlockchainTransaction) -> dict[str, Any]:
    """
    digital_signature_valid: registry Ed25519 signature over the stored tx_hash
                             (None when no public key is configured).
    smart_contract_valid:    block was written by the configured registry contract.
    consensus_verified:      status CONFIRMED by validators (reported, not a tamper signal).
    duplicate_tx_hash:       another block carries the same tx_hash.
    """
    duplicate = False
    if row.tx_hash:
        duplicate = (
            db.query(BlockchainTransaction.blockchain_tx_id)
            .filter(
                BlockchainTransaction.tx_hash == row.tx_hash,
                BlockchainTransaction.blockchain_tx_id != row.blockchain_tx_id,
            )
            .first()
            is not None
        )
    return {
        "digital_signature_valid": signing.verify(row.digital_signature, row.tx_hash),
        "smart_contract_valid": signing.contract_address_valid(row.smart_contract_address),
        "consensus_verified": signing.consensus_confirmed(
            row.transaction_status, row.consensus_verification
        ),
        "duplicate_tx_hash": duplicate,
    }


def verify_transaction(db: Session, transaction_id: str) -> dict[str, Any] | None:
    row = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.transaction_id == transaction_id.strip())
        .first()
    )
    if row is None:
        return None

    prop = None
    if row.property_id:
        prop = (
            db.query(Property)
            .filter(Property.property_id == row.property_id)
            .first()
        )

    expected_previous, is_chain_head = chain_context(db, row)
    stored_previous = row.previous_hash
    if is_genesis_previous(expected_previous) and is_genesis_previous(stored_previous):
        previous_hash_match = True
    else:
        previous_hash_match = (stored_previous or "") == (expected_previous or "")

    recomputed_data_hash = transaction_data_hash_for(
        row, _linked_transaction(db, row.transaction_id)
    )
    transaction_data_hash_match = (
        bool(row.transaction_data_hash)
        and row.transaction_data_hash == recomputed_data_hash
    )

    # Prefer verifying against the chain-correct previous hash when stored is genesis-linked.
    if previous_hash_match:
        chain_previous = expected_previous
    else:
        chain_previous = (
            stored_previous if stored_previous is not None else GENESIS_PREVIOUS_HASH
        )
    recomputed_tx = compute_tx_hash(
        previous_hash=chain_previous,
        transaction_data_hash=recomputed_data_hash,
        block_timestamp=row.block_timestamp,
    )
    tx_hash_match = bool(row.tx_hash) and row.tx_hash == recomputed_tx

    anchor = check_property_anchor(db, row, prop, is_chain_head=is_chain_head)
    document_hash_match, documents = check_documents(db, row.transaction_id)
    first_hashed = next((d for d in documents if d["document_hash"]), None)
    ledger = check_ledger_authenticity(db, row)

    all_ok = (
        tx_hash_match
        and transaction_data_hash_match
        and previous_hash_match
        and anchor["property_hash_match"]
        and document_hash_match
        and ledger["digital_signature_valid"] is not False
        and ledger["smart_contract_valid"]
        and not ledger["duplicate_tx_hash"]
    )

    chain_position = (
        "GENESIS" if is_genesis_previous(stored_previous) else "LINKED"
    )

    return {
        "tx_hash_match": tx_hash_match,
        "transaction_data_hash_match": transaction_data_hash_match,
        "previous_hash_match": previous_hash_match,
        "property_hash_match": anchor["property_hash_match"],
        "property_snapshot_match": anchor["property_snapshot_match"],
        "property_current_match": anchor["property_current_match"],
        "document_hash_match": document_hash_match,
        "digital_signature_valid": ledger["digital_signature_valid"],
        "smart_contract_valid": ledger["smart_contract_valid"],
        "consensus_verified": ledger["consensus_verified"],
        "duplicate_tx_hash": ledger["duplicate_tx_hash"],
        "integrity": "VALID" if all_ok else "INVALID",
        "details": {
            "blockchain_tx_id": row.blockchain_tx_id,
            "transaction_id": row.transaction_id,
            "property_id": row.property_id,
            "title_deed_number": prop.title_deed_number if prop else None,
            "tx_hash": row.tx_hash,
            "recomputed_tx_hash": recomputed_tx,
            "transaction_data_hash": row.transaction_data_hash,
            "recomputed_transaction_data_hash": recomputed_data_hash,
            "previous_hash": row.previous_hash,
            "expected_previous_hash": expected_previous,
            "property_hash": row.property_hash,
            "recomputed_property_hash": anchor["recomputed_property_hash"],
            "property_changes": anchor["property_changes"],
            "document_hash": first_hashed["document_hash"] if first_hashed else None,
            "recomputed_document_hash": (
                first_hashed["recomputed_document_hash"] if first_hashed else None
            ),
            "documents": documents,
            "block_number": row.block_number,
            "block_timestamp": row.block_timestamp,
            "transaction_value": row.transaction_value,
            "transaction_status": row.transaction_status,
            "consensus_verification": row.consensus_verification,
            "digital_signature": row.digital_signature,
            "smart_contract_address": row.smart_contract_address,
            "expected_smart_contract_address": settings.REGISTRY_CONTRACT_ADDRESS,
            "chain_position": chain_position,
            "is_chain_head": is_chain_head,
        },
    }


def list_hash_details(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 50,
    q: str | None = None,
    property_id: str | None = None,
    transaction_id: str | None = None,
    property_ids: set[str] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Read from core.v_blockchain_hash_details (one row per blockchain_tx_id)."""
    filters: list[str] = []
    params: dict[str, Any] = {"skip": skip, "limit": limit}

    if property_ids is not None:
        if not property_ids:
            return [], 0
        placeholders = []
        for index, pid in enumerate(property_ids):
            key = f"allowed_pid_{index}"
            placeholders.append(f":{key}")
            params[key] = pid
        filters.append(f"property_id IN ({', '.join(placeholders)})")
    if property_id and property_id.strip():
        filters.append("property_id = :property_id")
        params["property_id"] = property_id.strip()
    if transaction_id and transaction_id.strip():
        filters.append("transaction_id = :transaction_id")
        params["transaction_id"] = transaction_id.strip()
    if q and q.strip():
        filters.append(
            "("
            "transaction_id ILIKE :q OR property_id ILIKE :q OR "
            "tx_hash ILIKE :q OR previous_hash ILIKE :q OR property_hash ILIKE :q OR "
            "transaction_data_hash ILIKE :q"
            ")"
        )
        params["q"] = f"%{q.strip()}%"

    where = f"WHERE {' AND '.join(filters)}" if filters else ""

    # Deduplicate view rows when multiple documents share a transaction_id.
    base_cte = f"""
        SELECT DISTINCT ON (blockchain_tx_id)
            blockchain_tx_id,
            transaction_id,
            property_id,
            title_deed_number,
            tx_hash,
            previous_hash,
            property_hash,
            block_number,
            block_timestamp,
            transaction_value,
            transaction_status,
            document_hash,
            chain_position,
            transaction_data_hash
        FROM core.v_blockchain_hash_details
        {where}
        ORDER BY blockchain_tx_id, document_hash NULLS LAST
    """

    count_sql = text(f"SELECT COUNT(*) FROM ({base_cte}) AS d")
    total = int(db.execute(count_sql, params).scalar() or 0)

    list_sql = text(
        f"""
        SELECT * FROM ({base_cte}) AS d
        ORDER BY block_number ASC NULLS LAST,
                 block_timestamp ASC NULLS LAST,
                 blockchain_tx_id ASC
        OFFSET :skip LIMIT :limit
        """
    )
    rows = db.execute(list_sql, params).mappings().all()

    match_keys = (
        "tx_hash_match",
        "transaction_data_hash_match",
        "previous_hash_match",
        "property_hash_match",
        "property_snapshot_match",
        "property_current_match",
        "document_hash_match",
        "digital_signature_valid",
        "smart_contract_valid",
        "consensus_verified",
        "duplicate_tx_hash",
    )
    items: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        tid = item.get("transaction_id")
        verified = verify_transaction(db, str(tid)) if tid else None
        item["integrity"] = verified["integrity"] if verified else "INVALID"
        for key in match_keys:
            item[key] = verified[key] if verified else False
        items.append(item)

    return items, total


def ensure_transaction_data_hash_column(db: Session) -> None:
    """Add blockchain_transactions.transaction_data_hash if missing (idempotent)."""
    db.execute(
        text(
            """
            ALTER TABLE core.blockchain_transactions
            ADD COLUMN IF NOT EXISTS transaction_data_hash VARCHAR(255)
            """
        )
    )
    db.commit()


def ensure_hash_details_view(db: Session) -> None:
    """Create/replace the verification view (idempotent)."""
    ensure_transaction_data_hash_column(db)
    db.execute(
        text(
            """
            CREATE OR REPLACE VIEW core.v_blockchain_hash_details AS
            SELECT
              bt.blockchain_tx_id,
              bt.transaction_id,
              bt.property_id,
              p.title_deed_number,
              bt.tx_hash,
              bt.previous_hash,
              bt.property_hash,
              bt.block_number,
              bt.block_timestamp,
              bt.transaction_value,
              bt.transaction_status,
              pd.document_hash,
              CASE
                WHEN bt.previous_hash IS NULL OR bt.previous_hash = '0' THEN 'GENESIS'
                ELSE 'LINKED'
              END AS chain_position,
              bt.transaction_data_hash
            FROM core.blockchain_transactions bt
            LEFT JOIN core.properties p ON p.property_id = bt.property_id
            LEFT JOIN core.property_documents pd ON pd.transaction_id = bt.transaction_id
            """
        )
    )
    db.commit()


def ensure_tx_hash_nullable(db: Session) -> None:
    """Allow clearing tx_hash to NULL between regenerations."""
    db.execute(
        text(
            """
            ALTER TABLE core.blockchain_transactions
            ALTER COLUMN tx_hash DROP NOT NULL
            """
        )
    )
    db.commit()
