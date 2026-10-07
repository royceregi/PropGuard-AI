"""Phase 10 — Notification API Endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User as UserModel
from app.repositories import notification_repository
from app.schemas.notification import (
    NotificationCreate,
    NotificationRead,
    NotificationStats,
    PaginatedNotifications,
)

router = APIRouter()

ALL_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
ADMIN_ROLES = ["SYSTEM", "REGISTRY"]


@router.get("/", response_model=PaginatedNotifications)
def list_my_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Fetch notifications for the signed-in user."""
    items, total, unread_count = notification_repository.list_notifications(
        db,
        user_id=current_user.user_id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )
    return PaginatedNotifications(
        items=items,
        total=total,
        unread_count=unread_count,
        skip=skip,
        limit=limit,
    )


@router.get("/unread-count", response_model=NotificationStats)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Unread badge counter for UI bell icon."""
    unread_count = notification_repository.get_unread_count(db, current_user.user_id)
    _, total, _ = notification_repository.list_notifications(
        db, user_id=current_user.user_id, skip=0, limit=1
    )
    return NotificationStats(unread_count=unread_count, total_count=total)


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Mark a single notification as read."""
    notif = notification_repository.mark_as_read(
        db,
        notification_id=notification_id,
        user_id=current_user.user_id,
    )
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif


@router.patch("/read-all", response_model=dict[str, int])
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Mark all notifications as read for current user."""
    updated_count = notification_repository.mark_all_as_read(db, current_user.user_id)
    return {"updated_count": updated_count}


@router.delete("/{notification_id}", response_model=dict[str, bool])
def delete_notification(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Delete a notification."""
    success = notification_repository.delete_notification(
        db,
        notification_id=notification_id,
        user_id=current_user.user_id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/", response_model=NotificationRead)
def create_system_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    """Admin endpoint to dispatch system notifications."""
    return notification_repository.create_notification(
        db,
        user_id=payload.user_id,
        type=payload.type,
        title=payload.title,
        message=payload.message,
        link=payload.link,
    )
