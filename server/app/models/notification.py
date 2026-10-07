from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "core"}

    notification_id = Column(String(50), primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now())
