from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class TransactionFeature(Base):
    """Per-transaction features for risk scoring (imported table; blockchain columns from sql/012)."""

    __tablename__ = "transaction_features"
    __table_args__ = {"schema": "core"}

    feature_id = Column(BigInteger, primary_key=True)
    transaction_id = Column(Text, nullable=False, unique=True)
    property_id = Column(Text, nullable=False, index=True)
    hash_chain_valid = Column(Boolean)
    seller_matches_owner = Column(Boolean)
    has_active_encumbrance = Column(Boolean)
    property_hash_match = Column(Boolean)
    transaction_hash_match = Column(Boolean)
    document_hash_match = Column(Boolean)
    digital_signature_valid = Column(Boolean)
    smart_contract_valid = Column(Boolean)
    blockchain_transaction_confirmed = Column(Boolean)
    duplicate_blockchain_tx = Column(Boolean)
    from_wallet_matches_seller = Column(Boolean)
    to_wallet_matches_buyer = Column(Boolean)
    buyer_matches_new_owner = Column(Boolean)
    blockchain_value_matches_db = Column(Boolean)
    blockchain_type_matches_db = Column(Boolean)
    blockchain_timestamp_valid = Column(Boolean)
    blockchain_integrity = Column(String(10))
    blockchain_checked_at = Column(DateTime)


class RiskAssessment(Base):
    """Scored assessment of one transaction (rule engine output)."""

    __tablename__ = "risk_assessments"
    __table_args__ = {"schema": "core"}

    assessment_id = Column(BigInteger, primary_key=True)
    transaction_id = Column(Text, nullable=False, index=True)
    property_id = Column(Text, nullable=False, index=True)
    risk_score = Column(Numeric)
    risk_level = Column(String(20))
    model_name = Column(String(100))
    model_version = Column(String(50))
    assessment_status = Column(String(50), server_default="Completed")
    explanation = Column(Text)
    reviewed_by = Column(Text)
    review_status = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())


class RiskIndicator(Base):
    """One reason behind a risk assessment, with its evidence."""

    __tablename__ = "risk_indicators"
    __table_args__ = {"schema": "core"}

    indicator_id = Column(BigInteger, primary_key=True)
    assessment_id = Column(
        BigInteger, ForeignKey("core.risk_assessments.assessment_id"), nullable=False, index=True
    )
    indicator_code = Column(String(100), nullable=False)
    indicator_name = Column(String(255))
    indicator_value = Column(Numeric)
    severity = Column(String(20))
    description = Column(Text)
    evidence_reference = Column(Text)


class AgentRun(Base):
    """One agent execution (input, output, timing) for audit and latency measurement."""

    __tablename__ = "agent_runs"
    __table_args__ = {"schema": "core"}

    agent_run_id = Column(BigInteger, primary_key=True)
    query_id = Column(Text)
    agent_name = Column(String(100), nullable=False)
    input_data = Column(JSONB)
    output_data = Column(JSONB)
    status = Column(String(50))
    confidence_score = Column(Numeric)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)


class RiskAssessmentRequest(Base):
    """A requester's ask for a registry-verified risk assessment of one property."""

    __tablename__ = "risk_assessment_requests"
    __table_args__ = {"schema": "core"}

    request_id = Column(String(32), primary_key=True)
    property_id = Column(Text, nullable=False, index=True)
    requester_id = Column(Text, nullable=False, index=True)
    requester_access_level = Column(String(50), nullable=False)
    requester_notes = Column(Text)
    include_evidence = Column(Boolean, nullable=False, default=True, server_default="true")
    submitted_snapshot = Column(JSONB, nullable=False)

    status = Column(String(30), nullable=False, index=True, default="SUBMITTED")
    reviewer_id = Column(Text)
    verification_checks = Column(JSONB, nullable=False, default=dict, server_default="{}")
    risk_score = Column(Integer)
    risk_level = Column(String(20))
    registry_notes = Column(Text)
    rejection_reason = Column(Text)
    system_signals = Column(JSONB)
    result_hash = Column(String(64))
    history = Column(JSONB, nullable=False, default=list, server_default="[]")

    submitted_at = Column(DateTime, nullable=False, server_default=func.now())
    review_started_at = Column(DateTime)
    completed_at = Column(DateTime)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


__all__ = [
    "AgentRun",
    "RiskAssessment",
    "RiskAssessmentRequest",
    "RiskIndicator",
    "TransactionFeature",
]
