"""Phase 10 — Unit and Integration tests for Notifications API & Triggers."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.notification import Notification
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def mock_user(user_id: str = "USR-NOTIF", access_level: str = "PUBLIC") -> User:
    u = User()
    u.user_id = user_id
    u.access_level = access_level
    u.is_active = True
    u.role = "User"
    u.username = f"user_{user_id}"
    u.email = f"{user_id}@example.com"
    return u


def make_mock_notification(
    notif_id: str = "NOTIF-001",
    user_id: str = "USR-NOTIF",
    is_read: bool = False,
) -> Notification:
    n = Notification()
    n.notification_id = notif_id
    n.user_id = user_id
    n.type = "PROPERTY_SHARED"
    n.title = "Test Notification Title"
    n.message = "Test Notification Message Content"
    n.link = "/properties/PROP-100"
    n.is_read = is_read
    n.created_at = datetime.now()
    return n


def make_mock_db(notif: Notification | None = None):
    db = MagicMock()

    def query_side_effect(*args):
        m = MagicMock()
        model = args[0] if args else None
        if model is Notification:
            m.filter.return_value.first.return_value = notif
            m.filter.return_value.all.return_value = [notif] if notif else []
            m.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = (
                [notif] if notif else []
            )
            m.filter.return_value.count.return_value = 1 if notif else 0
        else:
            m.filter.return_value.all.return_value = []
            m.filter.return_value.first.return_value = None
            m.filter.return_value.count.return_value = 0
            m.filter.return_value.scalar.return_value = 1 if notif and not notif.is_read else 0
        return m

    db.query.side_effect = query_side_effect
    return db


def test_list_notifications_empty():
    user = mock_user("USR-NOTIF")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: make_mock_db(notif=None)

    try:
        res = client.get("/api/v1/notifications/")
        assert res.status_code == 200
        data = res.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["unread_count"] == 0
    finally:
        app.dependency_overrides.clear()


def test_list_notifications_with_item():
    user = mock_user("USR-NOTIF")
    notif = make_mock_notification(notif_id="NOTIF-001", user_id="USR-NOTIF", is_read=False)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: make_mock_db(notif=notif)

    try:
        res = client.get("/api/v1/notifications/")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["notification_id"] == "NOTIF-001"
        assert data["items"][0]["type"] == "PROPERTY_SHARED"
    finally:
        app.dependency_overrides.clear()


def test_get_unread_count():
    user = mock_user("USR-NOTIF")
    notif = make_mock_notification(notif_id="NOTIF-001", user_id="USR-NOTIF", is_read=False)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: make_mock_db(notif=notif)

    try:
        res = client.get("/api/v1/notifications/unread-count")
        assert res.status_code == 200
        data = res.json()
        assert "unread_count" in data
        assert "total_count" in data
    finally:
        app.dependency_overrides.clear()


def test_mark_notification_as_read():
    user = mock_user("USR-NOTIF")
    notif = make_mock_notification(notif_id="NOTIF-001", user_id="USR-NOTIF", is_read=False)
    db = make_mock_db(notif=notif)

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.patch("/api/v1/notifications/NOTIF-001/read")
        assert res.status_code == 200
        data = res.json()
        assert data["notification_id"] == "NOTIF-001"
        assert data["is_read"] is True
    finally:
        app.dependency_overrides.clear()


def test_mark_all_notifications_as_read():
    user = mock_user("USR-NOTIF")
    db = MagicMock()
    db.query.return_value.filter.return_value.update.return_value = 3

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.patch("/api/v1/notifications/read-all")
        assert res.status_code == 200
        data = res.json()
        assert data["updated_count"] == 3
    finally:
        app.dependency_overrides.clear()


def test_delete_notification():
    user = mock_user("USR-NOTIF")
    notif = make_mock_notification(notif_id="NOTIF-001", user_id="USR-NOTIF")
    db = make_mock_db(notif=notif)

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.delete("/api/v1/notifications/NOTIF-001")
        assert res.status_code == 200
        assert res.json()["success"] is True
    finally:
        app.dependency_overrides.clear()


def test_create_system_notification_as_admin():
    admin = mock_user("ADM-001", "SYSTEM")
    db = MagicMock()

    app.dependency_overrides[get_current_user] = lambda: admin
    app.dependency_overrides[get_db] = lambda: db

    try:
        payload = {
            "user_id": "USR-TARGET",
            "type": "SYSTEM_NOTICE",
            "title": "Scheduled Maintenance",
            "message": "System upgrade tonight at 22:00 UTC",
            "link": "/status",
        }
        res = client.post("/api/v1/notifications/", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["user_id"] == "USR-TARGET"
        assert data["type"] == "SYSTEM_NOTICE"
        assert data["title"] == "Scheduled Maintenance"
    finally:
        app.dependency_overrides.clear()
