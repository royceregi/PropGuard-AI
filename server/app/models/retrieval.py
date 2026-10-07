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
)

from app.core.database import Base


class QueryLog(Base):
    """One retrieval or investigation query (07-information-retrieval.md §Logging)."""

    __tablename__ = "query_logs"
    __table_args__ = {"schema": "core"}

    query_id = Column(Text, primary_key=True)
    user_id = Column(Text, ForeignKey("core.users.user_id"))
    query_text = Column(Text)
    log_timestamp = Column(DateTime)
    agent_response = Column(Text)
    confidence_score = Column(Numeric)
    relevance_score = Column(Numeric)
    flagged_suspicious = Column(Boolean)
    agent_used = Column(String(100))
    response_time_ms = Column(Integer)


class QueryRetrieval(Base):
    """One retrieved transaction / document for a query, with rank and relevance."""

    __tablename__ = "query_retrievals"
    __table_args__ = {"schema": "core"}

    retrieval_id = Column(BigInteger, primary_key=True)
    query_id = Column(Text, ForeignKey("core.query_logs.query_id"))
    transaction_id = Column(Text, ForeignKey("core.property_transactions.transaction_id"))
    document_id = Column(BigInteger, ForeignKey("core.property_documents.document_id"))
    rank = Column(Integer)
    relevance_score = Column(Numeric)
