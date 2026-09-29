from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BlockchainTransactionRead(BaseModel):
    blockchain_tx_id: int
    transaction_id: str | None = None
    property_id: str | None = None
    tx_hash: str | None = None
    previous_hash: str | None = None
    property_hash: str | None = None
    block_number: int | None = None
    block_timestamp: datetime | None = None
    from_wallet: str | None = None
    to_wallet: str | None = None
    transaction_type: str | None = None
    transaction_value: Decimal | None = None
    currency: str | None = None
    smart_contract_address: str | None = None
    digital_signature: str | None = None
    transaction_status: str | None = None
    consensus_verification: str | None = None
    gas_fee: Decimal | None = None
    created_at: datetime | None = None
    explorer_url: str | None = None
    payload_hash: str | None = Field(
        default=None,
        description="transaction_data_hash recomputed from current ledger + transaction data",
    )
    transaction_data_hash: str | None = Field(
        default=None, description="transaction_data_hash anchored on the ledger row"
    )
    previous_hash_valid: bool | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedBlockchainTransactions(BaseModel):
    items: list[BlockchainTransactionRead]
    total: int
    skip: int
    limit: int


def _required(value: str, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{label} is required")
    return cleaned


class BlockchainVerifyRequest(BaseModel):
    """Property + transaction details typed by the verifying user (registry, company, or buyer)."""

    property_id: str
    title_deed_number: str
    address: str
    district: str
    city: str
    land_area: str
    area_unit: str
    land_type: str
    survey_plan_number: str | None = None
    current_usage_type: str | None = None
    current_subtype: str | None = None

    transaction_id: str
    transaction_type: str
    transaction_datetime: str
    transaction_value: str
    currency: str
    from_wallet: str
    to_wallet: str

    @field_validator(
        "property_id",
        "title_deed_number",
        "address",
        "district",
        "city",
        "land_area",
        "area_unit",
        "land_type",
        "transaction_id",
        "transaction_type",
        "transaction_datetime",
        "transaction_value",
        "currency",
        "from_wallet",
        "to_wallet",
    )
    @classmethod
    def _not_blank(cls, value: str, info) -> str:
        return _required(value, info.field_name.replace("_", " ").capitalize())


class FieldMismatch(BaseModel):
    section: Literal["property", "transaction", "blockchain"]
    field: str
    label: str
    submitted: str | None = None
    recorded: str | None = None
    source: str
    note: str | None = None


class BlockchainVerifyResponse(BaseModel):
    status: Literal["MATCH", "MISMATCH", "NOT_FOUND"]
    matched: bool
    property_id: str
    transaction_id: str
    checked_fields: int
    mismatches: list[FieldMismatch] = Field(default_factory=list)
    detail: str


class VerificationFormOptions(BaseModel):
    area_units: list[str]
    transaction_types: list[str]
    currencies: list[str]
    districts: list[str]
    cities: list[str]
    land_types: list[str]
    usage_types: list[str]
    usage_subtypes: list[str]
