from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HashClearResponse(BaseModel):
    cleared: int
    detail: str = "Ledger tx_hash, previous_hash, property_hash, and transaction_data_hash cleared."


class HashRegenerateResponse(BaseModel):
    total: int
    success: int
    failed: int
    detail: str = "Ledger hashes regenerated from canonical formulas."


class HashRebuildResponse(BaseModel):
    cleared: int
    total: int
    success: int
    failed: int
    detail: str = "Ledger hashes cleared and regenerated in one transaction."


class BlockchainHashDetail(BaseModel):
    blockchain_tx_id: int
    transaction_id: str | None = None
    property_id: str | None = None
    title_deed_number: str | None = None
    tx_hash: str | None = None
    previous_hash: str | None = None
    property_hash: str | None = None
    transaction_data_hash: str | None = None
    block_number: int | None = None
    block_timestamp: datetime | None = None
    transaction_value: Decimal | None = None
    transaction_status: str | None = None
    document_hash: str | None = None
    chain_position: str | None = None
    integrity: str | None = None
    tx_hash_match: bool | None = None
    transaction_data_hash_match: bool | None = None
    previous_hash_match: bool | None = None
    property_hash_match: bool | None = None
    property_snapshot_match: bool | None = None
    property_current_match: bool | None = None
    document_hash_match: bool | None = None
    digital_signature_valid: bool | None = None
    smart_contract_valid: bool | None = None
    consensus_verified: bool | None = None
    duplicate_tx_hash: bool | None = None

    model_config = ConfigDict(from_attributes=True)


class PaginatedBlockchainHashDetails(BaseModel):
    items: list[BlockchainHashDetail]
    total: int
    skip: int
    limit: int


class CheckEvidence(BaseModel):
    table: str
    id: str | None = None


class RegistryCheck(BaseModel):
    code: str
    name: str
    category: Literal["ledger", "parties", "ownership", "registration"]
    status: Literal["PASS", "WARN", "FAIL", "NA"]
    expected: str | None = None
    actual: str | None = None
    reason: str
    evidence: list[CheckEvidence] = Field(default_factory=list)


class RegistryChecksResponse(BaseModel):
    transaction_id: str
    property_id: str | None = None
    overall: Literal["PASS", "WARN", "FAIL"]
    counts: dict[str, int]
    checks: list[RegistryCheck]


class PropertyFieldChange(BaseModel):
    field: str
    anchored: str | None = None
    current: str | None = None


class DocumentHashCheck(BaseModel):
    document_id: int
    document_type: str | None = None
    document_number: str | None = None
    document_hash: str | None = None
    recomputed_document_hash: str | None = None
    match: bool | None = Field(
        default=None, description="None when the document has no stored hash"
    )


class HashVerifyDetails(BaseModel):
    blockchain_tx_id: int | None = None
    transaction_id: str | None = None
    property_id: str | None = None
    title_deed_number: str | None = None
    tx_hash: str | None = None
    recomputed_tx_hash: str | None = None
    transaction_data_hash: str | None = None
    recomputed_transaction_data_hash: str | None = None
    previous_hash: str | None = None
    expected_previous_hash: str | None = None
    property_hash: str | None = None
    recomputed_property_hash: str | None = None
    property_changes: list[PropertyFieldChange] = Field(default_factory=list)
    document_hash: str | None = None
    recomputed_document_hash: str | None = None
    documents: list[DocumentHashCheck] = Field(default_factory=list)
    block_number: int | None = None
    block_timestamp: datetime | None = None
    transaction_value: Decimal | None = None
    transaction_status: str | None = None
    consensus_verification: str | None = None
    digital_signature: str | None = None
    smart_contract_address: str | None = None
    expected_smart_contract_address: str | None = None
    chain_position: str | None = None
    is_chain_head: bool | None = None


class HashVerifyResponse(BaseModel):
    tx_hash_match: bool
    transaction_data_hash_match: bool
    previous_hash_match: bool
    property_hash_match: bool
    property_snapshot_match: bool
    property_current_match: bool
    document_hash_match: bool
    digital_signature_valid: bool | None = Field(
        default=None,
        description="Registry Ed25519 signature over tx_hash; None when no public key is configured",
    )
    smart_contract_valid: bool
    consensus_verified: bool = Field(
        description="Status CONFIRMED by validators; reported only, does not affect integrity"
    )
    duplicate_tx_hash: bool
    integrity: str = Field(description="VALID or INVALID")
    details: HashVerifyDetails
