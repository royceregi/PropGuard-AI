from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Property(Base):
    __tablename__ = "properties"
    __table_args__ = {"schema": "core"}

    property_id = Column(String, primary_key=True)
    title_deed_number = Column(String)
    property_name = Column(String)
    address = Column(Text)
    district = Column(String)
    city = Column(String)
    land_area = Column(Numeric)
    area_unit = Column(String)
    land_type = Column(String)
    survey_plan_number = Column(String)
    current_owner_id = Column(Text)
    current_usage_type = Column(String)
    current_subtype = Column(String)
    current_value = Column(Numeric)
    legal_status = Column(String)
    verification_status = Column(String)
    encumbrances = Column(Text)
    boundary_north = Column(Text)
    boundary_south = Column(Text)
    boundary_east = Column(Text)
    boundary_west = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)


class PropertyDocument(Base):
    __tablename__ = "property_documents"
    __table_args__ = {"schema": "core"}

    document_id = Column(BigInteger, primary_key=True)
    property_id = Column(Text, index=True)
    transaction_id = Column(Text, index=True)
    document_type = Column(String)
    document_number = Column(String)
    document_text = Column(Text)
    document_hash = Column(String)
    document_url = Column(Text)
    issued_date = Column(Date)
    verification_status = Column(String)
    created_at = Column(DateTime)


class PropertyOwnershipHistory(Base):
    __tablename__ = "property_ownership_history"
    __table_args__ = {"schema": "core"}

    ownership_id = Column(BigInteger, primary_key=True)
    property_id = Column(Text, index=True)
    owner_id = Column(Text, index=True)
    ownership_start_date = Column(Date)
    ownership_end_date = Column(Date)
    ownership_type = Column(String)
    transaction_id = Column(Text, index=True)
    ownership_status = Column(String)
    recorded_at = Column(DateTime)


class PropertyTransaction(Base):
    __tablename__ = "property_transactions"
    __table_args__ = {"schema": "core"}

    transaction_id = Column(String, primary_key=True)
    property_id = Column(Text, index=True)
    transaction_type_id = Column(Integer)
    transaction_group = Column(String)
    registration_type = Column(String)
    procedure_name = Column(String)
    transaction_datetime = Column(DateTime, index=True)
    transaction_value = Column(Numeric)
    previous_value = Column(Numeric)
    value_change_pct = Column(Numeric)
    procedure_area = Column(Numeric)
    meter_sale_price = Column(Numeric)
    currency = Column(String)
    status = Column(String)
    procedure_id = Column(String)
    trans_group_id = Column(String)
    area_id = Column(String)
    area_name = Column(String)
    project_number = Column(String)
    project_name = Column(String)
    master_project = Column(String)
    nearest_landmark = Column(String)
    rooms = Column(String)
    has_parking = Column(Boolean)
    created_at = Column(DateTime)


class TransactionParty(Base):
    """Links users to property transactions as seller/buyer/owner/etc."""

    __tablename__ = "transaction_parties"
    __table_args__ = {"schema": "core"}

    transaction_party_id = Column(BigInteger, primary_key=True)
    transaction_id = Column(Text, index=True)
    user_id = Column(Text, index=True)
    party_name = Column(String)
    role = Column(String)
    is_primary = Column(Boolean)


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"
    __table_args__ = {"schema": "core"}

    blockchain_tx_id = Column(BigInteger, primary_key=True)
    transaction_id = Column(Text, unique=True, index=True)
    property_id = Column(Text, index=True)
    tx_hash = Column(String(255), unique=True)
    previous_hash = Column(String(255))
    property_hash = Column(String(255))
    transaction_data_hash = Column(String(255))
    block_number = Column(BigInteger)
    block_timestamp = Column(DateTime)
    from_wallet = Column(String(255))
    to_wallet = Column(String(255))
    transaction_type = Column(String(100))
    transaction_value = Column(Numeric(18, 2))
    smart_contract_address = Column(String(255))
    digital_signature = Column(Text)
    transaction_status = Column(String(50))
    consensus_verification = Column(Text)
    gas_fee = Column(Numeric(18, 4))
    created_at = Column(DateTime)


class RegistrationDetail(Base):
    __tablename__ = "registration_details"
    __table_args__ = {"schema": "core"}

    registration_id = Column(BigInteger, primary_key=True)
    transaction_id = Column(Text, index=True)
    registration_number = Column(String)
    registration_date = Column(Date)
    registration_fee = Column(Numeric)
    tax_amount = Column(Numeric)
    other_fee = Column(Numeric)
    total_amount_paid = Column(Numeric)
    currency = Column(String)
    registration_status = Column(String)


class PropertySnapshot(Base):
    """Canonical property payload anchored by a ledger property_hash (content-addressed)."""

    __tablename__ = "property_snapshots"
    __table_args__ = {"schema": "core"}

    property_hash = Column(String(64), primary_key=True)
    property_id = Column(Text, index=True)
    payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


__all__ = [
    "Property",
    "PropertyDocument",
    "PropertyOwnershipHistory",
    "PropertyTransaction",
    "TransactionParty",
    "BlockchainTransaction",
    "PropertySnapshot",
    "RegistrationDetail",
]
