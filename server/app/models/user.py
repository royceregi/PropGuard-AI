from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from app.core.database import Base
from app.core.roles import AccessLevel, UserRole


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "core"}

    user_id = Column(String, primary_key=True)
    username = Column(String(100), unique=True, index=True)
    full_name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    phone_number = Column(String(50))
    password_hash = Column(Text, nullable=False)
    wallet_address = Column(String(255))
    nic_hash = Column(String(64), index=True)
    kyc_status = Column(String(50))
    access_level = Column(String(50), nullable=False, index=True)
    mfa_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    is_active = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, server_default=func.now())
    last_login = Column(DateTime, nullable=True)


__all__ = ["User", "AccessLevel", "UserRole"]
