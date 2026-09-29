from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class LinkedUserSummary(BaseModel):
    """Public user fields for property/transaction joins."""

    user_id: str
    full_name: str | None = None
    username: str | None = None
    wallet_address: str | None = None
    access_level: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PropertyRead(BaseModel):
    property_id: str
    title_deed_number: str | None = None
    property_name: str | None = None
    address: str | None = None
    district: str | None = None
    city: str | None = None
    land_area: Decimal | None = None
    area_unit: str | None = None
    land_type: str | None = None
    survey_plan_number: str | None = None
    current_owner_id: str | None = None
    current_owner: LinkedUserSummary | None = None
    current_usage_type: str | None = None
    current_subtype: str | None = None
    current_value: Decimal | None = None
    legal_status: str | None = None
    verification_status: str | None = None
    encumbrances: str | None = None
    boundary_north: str | None = None
    boundary_south: str | None = None
    boundary_east: str | None = None
    boundary_west: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRelatedProperty(PropertyRead):
    """Property linked to a user via ownership and/or transaction parties."""

    is_current_owner: bool = False
    in_ownership_history: bool = False
    in_transactions: bool = False
    party_roles: list[str] = Field(default_factory=list)


class PaginatedUserRelatedProperties(BaseModel):
    items: list[UserRelatedProperty]
    total: int
    skip: int
    limit: int


class PropertyDocumentRead(BaseModel):
    document_id: int
    property_id: str | None = None
    transaction_id: str | None = None
    document_type: str | None = None
    document_number: str | None = None
    document_text: str | None = None
    document_hash: str | None = None
    document_url: str | None = None
    issued_date: date | None = None
    verification_status: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PropertyOwnershipHistoryRead(BaseModel):
    ownership_id: int
    property_id: str | None = None
    owner_id: str | None = None
    owner: LinkedUserSummary | None = None
    ownership_start_date: date | None = None
    ownership_end_date: date | None = None
    ownership_type: str | None = None
    transaction_id: str | None = None
    ownership_status: str | None = None
    recorded_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TransactionPartyRead(BaseModel):
    transaction_party_id: int
    transaction_id: str | None = None
    user_id: str | None = None
    party_name: str | None = None
    role: str | None = None
    is_primary: bool | None = None
    user: LinkedUserSummary | None = None

    model_config = ConfigDict(from_attributes=True)


class PropertyTransactionRead(BaseModel):
    transaction_id: str
    property_id: str | None = None
    transaction_type_id: int | None = None
    transaction_group: str | None = None
    registration_type: str | None = None
    procedure_name: str | None = None
    transaction_datetime: datetime | None = None
    transaction_value: Decimal | None = None
    previous_value: Decimal | None = None
    value_change_pct: Decimal | None = None
    procedure_area: Decimal | None = None
    meter_sale_price: Decimal | None = None
    currency: str | None = None
    status: str | None = None
    procedure_id: str | None = None
    trans_group_id: str | None = None
    area_id: str | None = None
    area_name: str | None = None
    project_number: str | None = None
    project_name: str | None = None
    master_project: str | None = None
    nearest_landmark: str | None = None
    rooms: str | None = None
    has_parking: bool | None = None
    created_at: datetime | None = None
    seller: TransactionPartyRead | None = None
    buyer: TransactionPartyRead | None = None

    model_config = ConfigDict(from_attributes=True)


class PropertyTransactionDetailRead(PropertyTransactionRead):
    parties: list[TransactionPartyRead] = Field(default_factory=list)
    property: PropertyRead | None = None
    current_owner: LinkedUserSummary | None = None
    seller_matches_current_owner: bool | None = None


class PropertyDetailRead(PropertyRead):
    documents: list[PropertyDocumentRead] = Field(default_factory=list)
    transactions: list[PropertyTransactionRead] = Field(default_factory=list)
    ownership_history: list[PropertyOwnershipHistoryRead] = Field(
        default_factory=list
    )


class PaginatedProperties(BaseModel):
    items: list[PropertyRead]
    total: int
    skip: int
    limit: int


class PaginatedPropertyTransactions(BaseModel):
    items: list[PropertyTransactionRead]
    total: int
    skip: int
    limit: int


class PaginatedPropertyDocuments(BaseModel):
    items: list[PropertyDocumentRead]
    total: int
    skip: int
    limit: int


class PaginatedOwnershipHistory(BaseModel):
    items: list[PropertyOwnershipHistoryRead]
    total: int
    skip: int
    limit: int
