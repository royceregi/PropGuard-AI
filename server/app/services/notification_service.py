"""Phase 10 — Notification Event Service."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import notification_repository

logger = logging.getLogger(__name__)


def notify_property_shared(
    db: Session,
    owner_name: str,
    buyer_user_id: str,
    property_id: str,
    property_name: str | None = None,
) -> None:
    title = "New Property Shared With You"
    name = property_name or property_id
    message = f"Seller {owner_name} shared property '{name}' ({property_id}) with you for read-only inspection."
    link = f"/properties/{property_id}"
    try:
        notification_repository.create_notification(
            db,
            user_id=buyer_user_id,
            type="PROPERTY_SHARED",
            title=title,
            message=message,
            link=link,
        )
    except Exception as exc:
        logger.error("Failed to send PROPERTY_SHARED notification: %s", exc)


def notify_share_revoked(
    db: Session,
    buyer_user_id: str,
    property_id: str,
    property_name: str | None = None,
) -> None:
    title = "Property Access Revoked"
    name = property_name or property_id
    message = f"Access to shared property '{name}' ({property_id}) has been revoked by the owner."
    link = "/buyer-inbox"
    try:
        notification_repository.create_notification(
            db,
            user_id=buyer_user_id,
            type="SHARE_REVOKED",
            title=title,
            message=message,
            link=link,
        )
    except Exception as exc:
        logger.error("Failed to send SHARE_REVOKED notification: %s", exc)


def notify_risk_request_created(
    db: Session,
    buyer_user_id: str,
    request_id: str,
    property_id: str,
) -> None:
    # 1. Notify buyer confirmation
    try:
        notification_repository.create_notification(
            db,
            user_id=buyer_user_id,
            type="RISK_REQUEST_CREATED",
            title="Risk Assessment Request Submitted",
            message=f"Your risk analysis request {request_id} for property {property_id} has been queued for verification.",
            link=f"/risk-analysis?request={request_id}",
        )
    except Exception as exc:
        logger.error("Failed to send buyer RISK_REQUEST_CREATED notification: %s", exc)

    # 2. Notify Land Registry officers (the only role that reviews requests)
    try:
        officers = db.query(User.user_id).filter(User.access_level == "REGISTRY").all()
        for (off_id,) in officers:
            notification_repository.create_notification(
                db,
                user_id=off_id,
                type="RISK_REQUEST_CREATED",
                title="New Pending Risk Request",
                message=f"Risk assessment request {request_id} for property {property_id} requires review.",
                link=f"/risk-analysis/review/{request_id}",
            )
    except Exception as exc:
        logger.error("Failed to send registry RISK_REQUEST_CREATED notification: %s", exc)


def notify_risk_request_completed(
    db: Session,
    buyer_user_id: str,
    request_id: str,
    property_id: str,
    status: str,
    risk_level: str | None = None,
) -> None:
    risk_info = f" ({risk_level} Risk Level)" if risk_level else ""
    if status == "ISSUES_FOUND":
        title = "Risk Assessment: Issues Found"
        message = (
            f"The Land Registry reviewed request {request_id} for property {property_id} and "
            f"found issues{risk_info}. Please visit the Land Registry office to resolve them."
        )
    else:
        title = f"Risk Assessment {status.capitalize()}"
        message = f"Risk assessment request {request_id} for property {property_id} has been {status.lower()}{risk_info}."
    link = f"/risk-analysis?request={request_id}"
    try:
        notification_repository.create_notification(
            db,
            user_id=buyer_user_id,
            type="RISK_REQUEST_COMPLETED",
            title=title,
            message=message,
            link=link,
        )
    except Exception as exc:
        logger.error("Failed to send RISK_REQUEST_COMPLETED notification: %s", exc)


def notify_access_level_changed(
    db: Session,
    target_user_id: str,
    new_access_level: str,
) -> None:
    title = "Account Access Level Updated"
    message = f"Your account access level has been updated to {new_access_level}."
    link = "/settings"
    try:
        notification_repository.create_notification(
            db,
            user_id=target_user_id,
            type="ACCESS_LEVEL_CHANGED",
            title=title,
            message=message,
            link=link,
        )
    except Exception as exc:
        logger.error("Failed to send ACCESS_LEVEL_CHANGED notification: %s", exc)


def notify_blockchain_tamper_alert(
    db: Session,
    property_id: str,
    detail: str,
) -> None:
    title = "ALERT: Blockchain Hash Integrity Violation"
    message = f"Ledger integrity warning on Property {property_id}: {detail}"
    link = f"/properties/{property_id}"
    try:
        admins = db.query(User.user_id).filter(User.access_level.in_(["SYSTEM", "REGISTRY"])).all()
        for (admin_id,) in admins:
            notification_repository.create_notification(
                db,
                user_id=admin_id,
                type="BLOCKCHAIN_ALERT",
                title=title,
                message=message,
                link=link,
            )
    except Exception as exc:
        logger.error("Failed to send BLOCKCHAIN_ALERT notification: %s", exc)
