"""Canonical PropGuard ledger hash formulas (SHA-256 over deterministic payloads)."""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any


GENESIS_PREVIOUS_HASH = "0"

# Authoritative property fields for property_hash (excludes mutable status/timestamps).
PROPERTY_HASH_FIELDS = (
    "property_id",
    "title_deed_number",
    "address",
    "district",
    "city",
    "land_area",
    "area_unit",
    "land_type",
    "survey_plan_number",
    "current_usage_type",
    "current_subtype",
)

# Authoritative transaction fields for transaction_data_hash.
TRANSACTION_HASH_FIELDS = (
    "transaction_id",
    "property_id",
    "transaction_type",
    "transaction_datetime",
    "transaction_value",
    "currency",
    "from_wallet",
    "to_wallet",
    "property_hash",
)


def _as_str(value: Any) -> str:
    """NULL / None → empty string; otherwise stable string form for hashing."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        if value.microsecond:
            return value.strftime("%Y-%m-%dT%H:%M:%S.%f").rstrip("0").rstrip(".")
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def normalize_text(value: Any) -> str:
    return _as_str(value).strip()


def normalize_wallet(value: Any) -> str:
    return normalize_text(value).lower()


def normalize_currency(value: Any) -> str:
    return normalize_text(value).upper()


def normalize_money(value: Any) -> str:
    raw = normalize_text(value)
    if not raw:
        return ""
    try:
        return format(Decimal(raw), "f")
    except (InvalidOperation, ValueError):
        return raw


def normalize_type(value: Any) -> str:
    return normalize_text(value).upper().replace(" ", "_").replace("-", "_")


def sha256_hex(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def canonical_stringify(payload: dict[str, str]) -> str:
    """Deterministic JSON: sorted keys, compact separators."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def build_canonical_property_payload(
    *,
    property_id: Any = None,
    title_deed_number: Any = None,
    address: Any = None,
    district: Any = None,
    city: Any = None,
    land_area: Any = None,
    area_unit: Any = None,
    land_type: Any = None,
    survey_plan_number: Any = None,
    current_usage_type: Any = None,
    current_subtype: Any = None,
) -> dict[str, str]:
    return {
        "property_id": normalize_text(property_id),
        "title_deed_number": normalize_text(title_deed_number),
        "address": normalize_text(address),
        "district": normalize_text(district),
        "city": normalize_text(city),
        "land_area": normalize_money(land_area),
        "area_unit": normalize_type(area_unit),
        "land_type": normalize_text(land_type),
        "survey_plan_number": normalize_text(survey_plan_number),
        "current_usage_type": normalize_text(current_usage_type),
        "current_subtype": normalize_text(current_subtype),
    }


def property_payload_from(property_id: Any, source: Any) -> dict[str, str]:
    """Canonical property payload from any object exposing PROPERTY_HASH_FIELDS (or None)."""
    return build_canonical_property_payload(
        property_id=property_id,
        **{
            field: getattr(source, field, None)
            for field in PROPERTY_HASH_FIELDS
            if field != "property_id"
        },
    )


def hash_property_payload(payload: dict[str, str]) -> str:
    return sha256_hex(canonical_stringify(payload))


def compute_property_hash(
    *,
    property_id: Any = None,
    title_deed_number: Any = None,
    address: Any = None,
    district: Any = None,
    city: Any = None,
    land_area: Any = None,
    area_unit: Any = None,
    land_type: Any = None,
    survey_plan_number: Any = None,
    current_usage_type: Any = None,
    current_subtype: Any = None,
    # Legacy kwargs ignored so older call sites do not break.
    current_owner_id: Any = None,
) -> str:
    """property_hash = SHA-256(canonical JSON of authoritative property fields)."""
    del current_owner_id  # not part of canonical property payload
    payload = build_canonical_property_payload(
        property_id=property_id,
        title_deed_number=title_deed_number,
        address=address,
        district=district,
        city=city,
        land_area=land_area,
        area_unit=area_unit,
        land_type=land_type,
        survey_plan_number=survey_plan_number,
        current_usage_type=current_usage_type,
        current_subtype=current_subtype,
    )
    return sha256_hex(canonical_stringify(payload))


def build_canonical_transaction_payload(
    *,
    transaction_id: Any = None,
    property_id: Any = None,
    transaction_type: Any = None,
    transaction_datetime: Any = None,
    transaction_value: Any = None,
    currency: Any = None,
    from_wallet: Any = None,
    to_wallet: Any = None,
    property_hash: Any = None,
) -> dict[str, str]:
    return {
        "transaction_id": normalize_text(transaction_id),
        "property_id": normalize_text(property_id),
        "transaction_type": normalize_type(transaction_type),
        "transaction_datetime": normalize_text(transaction_datetime)
        if not isinstance(transaction_datetime, (datetime, date))
        else _as_str(transaction_datetime).replace(" ", "T"),
        "transaction_value": normalize_money(transaction_value),
        "currency": normalize_currency(currency),
        "from_wallet": normalize_wallet(from_wallet),
        "to_wallet": normalize_wallet(to_wallet),
        "property_hash": normalize_text(property_hash).lower(),
    }


def compute_transaction_data_hash(
    *,
    transaction_id: Any = None,
    property_id: Any = None,
    transaction_type: Any = None,
    transaction_datetime: Any = None,
    transaction_value: Any = None,
    currency: Any = None,
    from_wallet: Any = None,
    to_wallet: Any = None,
    property_hash: Any = None,
) -> str:
    """transaction_data_hash = SHA-256(canonical JSON of transaction + property_hash)."""
    payload = build_canonical_transaction_payload(
        transaction_id=transaction_id,
        property_id=property_id,
        transaction_type=transaction_type,
        transaction_datetime=transaction_datetime,
        transaction_value=transaction_value,
        currency=currency,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        property_hash=property_hash,
    )
    return sha256_hex(canonical_stringify(payload))


def compute_tx_hash(
    *,
    previous_hash: Any,
    transaction_data_hash: Any,
    block_timestamp: Any,
) -> str:
    """
    Chain link hash stored as blockchain_transactions.tx_hash:
    SHA256(previous_hash + transaction_data_hash + block_timestamp)
    """
    raw = (
        _as_str(previous_hash)
        + normalize_text(transaction_data_hash).lower()
        + _as_str(block_timestamp)
    )
    return sha256_hex(raw)


def compute_document_hash(document_text: Any) -> str:
    """document_hash = SHA256(document_text)."""
    return sha256_hex(_as_str(document_text))


def is_genesis_previous(previous_hash: Any) -> bool:
    value = _as_str(previous_hash).strip()
    return value == "" or value == GENESIS_PREVIOUS_HASH


def values_equal(left: Any, right: Any, *, kind: str = "text") -> bool:
    if kind == "wallet":
        return normalize_wallet(left) == normalize_wallet(right) and bool(
            normalize_wallet(left)
        )
    if kind == "money":
        return normalize_money(left) == normalize_money(right) and bool(
            normalize_money(left)
        )
    if kind == "currency":
        return normalize_currency(left) == normalize_currency(right) and bool(
            normalize_currency(left)
        )
    if kind == "type":
        return normalize_type(left) == normalize_type(right) and bool(
            normalize_type(left)
        )
    if kind == "hash":
        a = normalize_text(left).lower()
        b = normalize_text(right).lower()
        return bool(a) and a == b
    return normalize_text(left) == normalize_text(right) and bool(normalize_text(left))
