"""Phase 10 — Notification Repository Layer."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import Notification


def create_notification(
    db: Session,
    user_id: str,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
) -> Notification:
    notif_id = f"NOTIF-{uuid.uuid4().hex[:10].upper()}"
    notif = Notification(
        notification_id=notif_id,
        user_id=user_id.strip(),
        type=type.strip(),
        title=title.strip(),
        message=message.strip(),
        link=link.strip() if link else None,
        is_read=False,
        created_at=datetime.now(),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def list_notifications(
    db: Session,
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
) -> tuple[list[Notification], int, int]:
    """Returns (items, total_count, unread_count)."""
    base_query = db.query(Notification).filter(Notification.user_id == user_id.strip())

    unread_count = (
        db.query(func.count(Notification.notification_id))
        .filter(Notification.user_id == user_id.strip(), Notification.is_read == False)
        .scalar()
        or 0
    )

    query = base_query
    if unread_only:
        query = query.filter(Notification.is_read == False)

    total = query.count()
    items = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    return items, total, unread_count


def get_unread_count(db: Session, user_id: str) -> int:
    return (
        db.query(func.count(Notification.notification_id))
        .filter(Notification.user_id == user_id.strip(), Notification.is_read == False)
        .scalar()
        or 0
    )


def mark_as_read(db: Session, notification_id: str, user_id: str) -> Notification | None:
    notif = (
        db.query(Notification)
        .filter(
            Notification.notification_id == notification_id.strip(),
            Notification.user_id == user_id.strip(),
        )
        .first()
    )
    if notif is None:
        return None

    if not notif.is_read:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif


def mark_all_as_read(db: Session, user_id: str) -> int:
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id.strip(),
            Notification.is_read == False,
        )
        .update({"is_read": True}, synchronize_session=False)
    )
    db.commit()
    return count


def delete_notification(db: Session, notification_id: str, user_id: str) -> bool:
    notif = (
        db.query(Notification)
        .filter(
            Notification.notification_id == notification_id.strip(),
            Notification.user_id == user_id.strip(),
        )
        .first()
    )
    if notif is None:
        return False

    db.delete(notif)
    db.commit()
    return True
