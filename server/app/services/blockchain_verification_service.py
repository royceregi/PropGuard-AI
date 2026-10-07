"""Compare registry-officer entered property + transaction details with recorded data."""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.hashing import (
    GENESIS_PREVIOUS_HASH,
    compute_tx_hash,
    is_genesis_previous,
    normalize_currency,
    normalize_type,
    normalize_wallet,
)
from app.models.property import BlockchainTransaction, Property, PropertyTransaction
from app.services.blockchain_hash_service import (
    chain_context,
    check_documents,
    check_ledger_authenticity,
    check_property_anchor,
    transaction_data_hash_for,
)

REGISTRY_SOURCE = "Land registry record"
LEDGER_SOURCE = "Blockchain ledger"
TRANSACTION_SOURCE = "Transaction record"

DEFAULT_AREA_UNITS = ["PERCH", "SQM", "SQFT", "ACRE", "HECTARE"]
DEFAULT_TRANSACTION_TYPES = ["SALE", "TRANSFER", "LEASE", "MORTGAGE", "GIFT"]
DEFAULT_CURRENCIES = ["LKR", "USD", "AED"]

_AREA_UNIT_ALIASES = {
    "PERCH": "PERCH",
    "PERCHES": "PERCH",
    "P": "PERCH",
    "SQM": "SQM",
    "SQ_M": "SQM",
    "SQ.M": "SQM",
    "M2": "SQM",
    "SQUARE_METER": "SQM",
    "SQUARE_METERS": "SQM",
    "SQUARE_METRE": "SQM",
    "SQUARE_METRES": "SQM",
    "SQFT": "SQFT",
    "SQ_FT": "SQFT",
    "SQ.FT": "SQFT",
    "FT2": "SQFT",
    "SQUARE_FEET": "SQFT",
    "SQUARE_FOOT": "SQFT",
    "ACRE": "ACRE",
    "ACRES": "ACRE",
    "AC": "ACRE",
    "HECTARE": "HECTARE",
    "HECTARES": "HECTARE",
    "HA": "HECTARE",
}


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _text_key(value: Any) -> str:
    return _clean(value).casefold()


def _decimal(value: Any) -> Decimal | None:
    raw = _clean(value).replace(",", "")
    if not raw:
        return None
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError):
        return None


def normalize_area_unit(value: Any) -> str:
    key = normalize_type(value)
    return _AREA_UNIT_ALIASES.get(key, key)


def _parse_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        raw = _clean(value)
        if not raw:
            return None
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00").replace(" ", "T"))
        except ValueError:
            return None
    if parsed.tzinfo is not None:
        parsed = parsed.replace(tzinfo=None)
    return parsed.replace(second=0, microsecond=0)


def _display(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, Decimal):
        return (
            format(value.normalize(), "f") if value == value.to_integral() else format(value, "f")
        )
    text = _clean(value)
    return text or None


class _Comparison:
    def __init__(self) -> None:
        self.checked: list[str] = []
        self.mismatches: list[dict[str, Any]] = []

    def add_mismatch(
        self,
        *,
        section: str,
        field: str,
        label: str,
        submitted: Any,
        recorded: Any,
        source: str,
        note: str | None = None,
    ) -> None:
        self.mismatches.append(
            {
                "section": section,
                "field": field,
                "label": label,
                "submitted": _display(submitted),
                "recorded": _display(recorded),
                "source": source,
                "note": note,
            }
        )

    def compare(
        self,
        *,
        section: str,
        field: str,
        label: str,
        submitted: Any,
        recorded: Any,
        source: str,
        equal: bool,
    ) -> None:
        self.checked.append(field)
        if not equal:
            self.add_mismatch(
                section=section,
                field=field,
                label=label,
                submitted=submitted,
                recorded=recorded,
                source=source,
            )

    def has_section_mismatch(self, section: str) -> bool:
        return any(item["section"] == section for item in self.mismatches)


def _text_equal(a: Any, b: Any) -> bool:
    return _text_key(a) == _text_key(b)


def _number_equal(a: Any, b: Any) -> bool:
    left, right = _decimal(a), _decimal(b)
    if left is None or right is None:
        return left is None and right is None
    return left == right


def _compare_property(result: _Comparison, payload: dict[str, Any], prop: Property) -> None:
    section = "property"
    text_fields = [
        ("title_deed_number", "Title deed number"),
        ("address", "Address"),
        ("district", "District"),
        ("city", "City"),
        ("land_type", "Land type"),
        ("survey_plan_number", "Survey plan number"),
        ("current_usage_type", "Usage type"),
        ("current_subtype", "Usage subtype"),
    ]
    required = {"title_deed_number", "address", "district", "city", "land_type"}
    for field, label in text_fields:
        submitted = payload.get(field)
        if field not in required and not _clean(submitted):
            continue
        recorded = getattr(prop, field)
        result.compare(
            section=section,
            field=field,
            label=label,
            submitted=submitted,
            recorded=recorded,
            source=REGISTRY_SOURCE,
            equal=_text_equal(submitted, recorded),
        )

    result.compare(
        section=section,
        field="land_area",
        label="Land area",
        submitted=payload.get("land_area"),
        recorded=prop.land_area,
        source=REGISTRY_SOURCE,
        equal=_number_equal(payload.get("land_area"), prop.land_area),
    )
    result.compare(
        section=section,
        field="area_unit",
        label="Area unit",
        submitted=payload.get("area_unit"),
        recorded=prop.area_unit,
        source=REGISTRY_SOURCE,
        equal=normalize_area_unit(payload.get("area_unit")) == normalize_area_unit(prop.area_unit),
    )


def _compare_transaction(
    result: _Comparison,
    payload: dict[str, Any],
    ledger: BlockchainTransaction,
    db_tx: PropertyTransaction | None,
    property_id: str,
) -> None:
    section = "transaction"

    if _clean(ledger.property_id) != property_id:
        result.add_mismatch(
            section=section,
            field="property_id",
            label="Property ID",
            submitted=property_id,
            recorded=ledger.property_id,
            source=LEDGER_SOURCE,
            note="This transaction is recorded against a different property.",
        )

    result.compare(
        section=section,
        field="transaction_type",
        label="Transaction type",
        submitted=payload.get("transaction_type"),
        recorded=ledger.transaction_type,
        source=LEDGER_SOURCE,
        equal=normalize_type(payload.get("transaction_type"))
        == normalize_type(ledger.transaction_type),
    )
    result.compare(
        section=section,
        field="transaction_value",
        label="Transaction value",
        submitted=payload.get("transaction_value"),
        recorded=ledger.transaction_value,
        source=LEDGER_SOURCE,
        equal=_number_equal(payload.get("transaction_value"), ledger.transaction_value),
    )

    if db_tx is not None and _clean(db_tx.currency):
        result.compare(
            section=section,
            field="currency",
            label="Currency",
            submitted=payload.get("currency"),
            recorded=db_tx.currency,
            source=TRANSACTION_SOURCE,
            equal=normalize_currency(payload.get("currency")) == normalize_currency(db_tx.currency),
        )

    recorded_dt = (db_tx.transaction_datetime if db_tx else None) or ledger.block_timestamp
    if recorded_dt is not None:
        result.compare(
            section=section,
            field="transaction_datetime",
            label="Transaction date & time",
            submitted=_parse_datetime(payload.get("transaction_datetime"))
            or payload.get("transaction_datetime"),
            recorded=recorded_dt.replace(second=0, microsecond=0),
            source=TRANSACTION_SOURCE if db_tx and db_tx.transaction_datetime else LEDGER_SOURCE,
            equal=_parse_datetime(payload.get("transaction_datetime"))
            == _parse_datetime(recorded_dt),
        )

    for field, label, recorded in (
        ("from_wallet", "Seller wallet", ledger.from_wallet),
        ("to_wallet", "Buyer wallet", ledger.to_wallet),
    ):
        result.compare(
            section=section,
            field=field,
            label=label,
            submitted=payload.get(field),
            recorded=recorded,
            source=LEDGER_SOURCE,
            equal=normalize_wallet(payload.get(field)) == normalize_wallet(recorded),
        )


def _check_ledger_integrity(
    db: Session,
    result: _Comparison,
    prop: Property,
    ledger: BlockchainTransaction,
    db_tx: PropertyTransaction | None,
) -> None:
    expected_previous, is_chain_head = chain_context(db, ledger)
    anchor = check_property_anchor(db, ledger, prop, is_chain_head=is_chain_head)
    if not anchor["property_hash_match"]:
        if anchor["property_changes"] and anchor["property_snapshot_match"]:
            for change in anchor["property_changes"]:
                result.add_mismatch(
                    section="blockchain",
                    field=f"anchored_{change['field']}",
                    label=f"Anchored {change['field'].replace('_', ' ')}",
                    submitted=change["current"],
                    recorded=change["anchored"],
                    source=LEDGER_SOURCE,
                    note="The registry record changed after the latest transaction was anchored.",
                )
        else:
            result.add_mismatch(
                section="blockchain",
                field="property_hash",
                label="On-chain property hash",
                submitted=anchor["recomputed_property_hash"],
                recorded=ledger.property_hash,
                source=LEDGER_SOURCE,
                note=(
                    "The anchored property snapshot does not match its hash."
                    if anchor["snapshot_found"] and not anchor["property_snapshot_match"]
                    else "The registry record no longer matches the property hash anchored on the blockchain."
                ),
            )

    _, documents = check_documents(db, ledger.transaction_id)
    for doc in documents:
        if doc["match"] is False:
            result.add_mismatch(
                section="blockchain",
                field=f"document_hash_{doc['document_id']}",
                label=f"Document hash ({doc['document_type'] or 'document'} #{doc['document_id']})",
                submitted=doc["recomputed_document_hash"],
                recorded=doc["document_hash"],
                source="Property document",
                note="The document text no longer matches its recorded hash.",
            )

    stored_previous = ledger.previous_hash
    if is_genesis_previous(expected_previous) and is_genesis_previous(stored_previous):
        previous_ok = True
    else:
        previous_ok = (stored_previous or "") == (expected_previous or "")

    recomputed_data_hash = transaction_data_hash_for(ledger, db_tx)
    recomputed = compute_tx_hash(
        previous_hash=expected_previous
        if previous_ok
        else (stored_previous if stored_previous is not None else GENESIS_PREVIOUS_HASH),
        transaction_data_hash=recomputed_data_hash,
        block_timestamp=ledger.block_timestamp,
    )
    if not previous_ok:
        result.add_mismatch(
            section="blockchain",
            field="previous_hash",
            label="Previous block hash",
            submitted=expected_previous,
            recorded=stored_previous,
            source=LEDGER_SOURCE,
            note="The block does not link to the previous block for this property.",
        )
    elif (ledger.transaction_data_hash or "").strip().lower() != recomputed_data_hash:
        result.add_mismatch(
            section="blockchain",
            field="transaction_data_hash",
            label="Transaction data hash",
            submitted=recomputed_data_hash,
            recorded=ledger.transaction_data_hash,
            source=LEDGER_SOURCE,
            note="The recorded transaction details no longer match the hash anchored on the blockchain.",
        )
    elif not ledger.tx_hash or ledger.tx_hash != recomputed:
        result.add_mismatch(
            section="blockchain",
            field="tx_hash",
            label="Transaction block hash",
            submitted=recomputed,
            recorded=ledger.tx_hash,
            source=LEDGER_SOURCE,
            note="The stored block hash does not match its recorded contents.",
        )

    authenticity = check_ledger_authenticity(db, ledger)
    if authenticity["digital_signature_valid"] is False:
        result.add_mismatch(
            section="blockchain",
            field="digital_signature",
            label="Registry signature",
            submitted="Valid registry signature",
            recorded=ledger.digital_signature,
            source=LEDGER_SOURCE,
            note="The block is not signed by the land-registry key.",
        )
    if not authenticity["smart_contract_valid"]:
        result.add_mismatch(
            section="blockchain",
            field="smart_contract_address",
            label="Registry contract",
            submitted=settings.REGISTRY_CONTRACT_ADDRESS,
            recorded=ledger.smart_contract_address,
            source=LEDGER_SOURCE,
            note="The block was not written by the registry smart contract.",
        )
    if authenticity["duplicate_tx_hash"]:
        result.add_mismatch(
            section="blockchain",
            field="duplicate_tx_hash",
            label="Duplicate block hash",
            submitted="Unique tx_hash",
            recorded=ledger.tx_hash,
            source=LEDGER_SOURCE,
            note="Another block carries the same transaction hash.",
        )


def compare_submission(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    property_id = _clean(payload.get("property_id"))
    transaction_id = _clean(payload.get("transaction_id"))

    prop = db.query(Property).filter(Property.property_id == property_id).first()
    ledger = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.transaction_id == transaction_id)
        .first()
    )
    db_tx = (
        db.query(PropertyTransaction)
        .filter(PropertyTransaction.transaction_id == transaction_id)
        .first()
    )

    if prop is None and ledger is None:
        return {
            "status": "NOT_FOUND",
            "matched": False,
            "property_id": property_id,
            "transaction_id": transaction_id,
            "checked_fields": 0,
            "mismatches": [],
            "detail": "No property or blockchain transaction exists for the entered IDs.",
        }

    result = _Comparison()

    if prop is None:
        result.add_mismatch(
            section="property",
            field="property_id",
            label="Property ID",
            submitted=property_id,
            recorded=None,
            source=REGISTRY_SOURCE,
            note="No property with this ID exists in the land registry.",
        )
    else:
        _compare_property(result, payload, prop)

    if ledger is None:
        result.add_mismatch(
            section="transaction",
            field="transaction_id",
            label="Transaction ID",
            submitted=transaction_id,
            recorded=None,
            source=LEDGER_SOURCE,
            note="No blockchain record exists for this transaction.",
        )
    else:
        _compare_transaction(result, payload, ledger, db_tx, property_id)

    if prop is not None and ledger is not None and not result.mismatches:
        _check_ledger_integrity(db, result, prop, ledger, db_tx)

    matched = not result.mismatches
    count = len(result.mismatches)
    return {
        "status": "MATCH" if matched else "MISMATCH",
        "matched": matched,
        "property_id": property_id,
        "transaction_id": transaction_id,
        "checked_fields": len(result.checked),
        "mismatches": result.mismatches,
        "detail": (
            "All entered details match the registry and blockchain records."
            if matched
            else f"{count} detail{'s' if count != 1 else ''} did not match the recorded data."
        ),
    }


def _distinct(db: Session, column, limit: int = 300) -> list[str]:
    rows = (
        db.query(column)
        .filter(column.isnot(None), func.trim(column) != "")
        .distinct()
        .order_by(column)
        .limit(limit)
        .all()
    )
    return [_clean(row[0]) for row in rows if _clean(row[0])]


def form_options(db: Session) -> dict[str, list[str]]:
    area_units = _distinct(db, Property.area_unit) or DEFAULT_AREA_UNITS
    transaction_types = (
        _distinct(db, BlockchainTransaction.transaction_type) or DEFAULT_TRANSACTION_TYPES
    )
    currencies = _distinct(db, PropertyTransaction.currency) or DEFAULT_CURRENCIES
    return {
        "area_units": area_units,
        "transaction_types": transaction_types,
        "currencies": currencies,
        "districts": _distinct(db, Property.district),
        "cities": _distinct(db, Property.city, limit=1000),
        "land_types": _distinct(db, Property.land_type),
        "usage_types": _distinct(db, Property.current_usage_type),
        "usage_subtypes": _distinct(db, Property.current_subtype),
    }
