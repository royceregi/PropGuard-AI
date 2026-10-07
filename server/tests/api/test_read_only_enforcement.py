"""Phase 8c — Unit and regression tests for Buyer/PUBLIC read-only enforcement."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.property import Property, PropertyShare
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def mock_buyer_user(user_id: str = "BUYER-001") -> User:
    u = User()
    u.user_id = user_id
    u.access_level = "PUBLIC"
    u.is_active = True
    u.role = "User"
    u.username = f"buyer_{user_id}"
    u.email = f"{user_id}@example.com"
    return u


def make_mock_db(prop: Property | None = None, share: PropertyShare | None = None):
    db = MagicMock()

    def query_side_effect(*args):
        m = MagicMock()
        model = args[0] if args else None

        if model is Property:
            m.filter.return_value.first.return_value = prop
        elif model is PropertyShare:
            m.filter.return_value.first.return_value = share
            m.filter.return_value.all.return_value = [share] if share else []
            m.filter.return_value.filter.return_value.order_by.return_value.all.return_value = (
                [share] if share else []
            )
            m.filter.return_value.order_by.return_value.all.return_value = [share] if share else []
        elif hasattr(model, "parent") and getattr(model.parent, "class_", None) is PropertyShare:
            m.filter.return_value.all.return_value = [share] if share else []
            m.filter.return_value.first.return_value = share
        else:
            m.filter.return_value.all.return_value = []
            m.filter.return_value.first.return_value = None

        return m

    db.query.side_effect = query_side_effect
    return db


def test_public_buyer_forbidden_on_admin_hash_maintenance():
    buyer = mock_buyer_user("BUYER-001")
    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: make_mock_db()

    try:
        endpoints = [
            "/api/v1/admin/blockchain/rebuild-hashes",
            "/api/v1/admin/blockchain/clear-hashes",
            "/api/v1/admin/blockchain/regenerate-hashes",
        ]
        for ep in endpoints:
            res = client.post(ep)
            assert res.status_code == 403, f"Expected 403 on {ep}, got {res.status_code}"
    finally:
        app.dependency_overrides.clear()


def test_public_buyer_forbidden_on_user_management():
    buyer = mock_buyer_user("BUYER-001")
    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: make_mock_db()

    try:
        assert (
            client.patch(
                "/api/v1/users/USR-002/access-level", json={"access_level": "ELEVATED"}
            ).status_code
            == 403
        )
        assert (
            client.patch("/api/v1/users/USR-002/active", json={"is_active": False}).status_code
            == 403
        )
        assert client.post("/api/v1/users/USR-002/approve").status_code == 403
        assert client.post("/api/v1/users/USR-002/reject").status_code == 403
        assert (
            client.put("/api/v1/users/USR-002", json={"kyc_status": "APPROVED"}).status_code == 403
        )
        assert client.delete("/api/v1/users/USR-002").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_public_buyer_forbidden_on_registry_reviews_and_investigations():
    buyer = mock_buyer_user("BUYER-001")
    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: make_mock_db()

    try:
        assert client.post("/api/v1/risk-assessments/REQ-100/start-review").status_code == 403
        assert (
            client.patch(
                "/api/v1/risk-assessments/REQ-100/draft", json={"review_notes": "draft"}
            ).status_code
            == 403
        )
        assert client.post("/api/v1/risk-assessments/REQ-100/verify").status_code == 403
        assert client.post("/api/v1/risk-assessments/REQ-100/reject").status_code == 403
        assert client.get("/api/v1/investigations/agent-runs").status_code == 403
        assert client.post("/api/v1/anomaly-model/train").status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_core_property_data_has_no_write_routes():
    buyer = mock_buyer_user("BUYER-001")
    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: make_mock_db()

    try:
        # Core property tables are frozen read-only; write endpoints return 405 Method Not Allowed or 404
        assert client.post("/api/v1/properties/").status_code in (404, 405)
        assert client.put("/api/v1/properties/PROP-100").status_code in (404, 405)
        assert client.post("/api/v1/property-transactions/").status_code in (404, 405)
        assert client.post("/api/v1/property-documents/").status_code in (404, 405)
    finally:
        app.dependency_overrides.clear()


def test_buyer_with_active_share_can_read_property_details():
    buyer = mock_buyer_user("BUYER-001")
    share = PropertyShare(
        share_id="SHR-100",
        property_id="PROP-100",
        owner_user_id="OWNER-1",
        buyer_user_id="BUYER-001",
        created_at=datetime.now(),
        expires_at=None,
        revoked_at=None,
    )
    prop = Property(
        property_id="PROP-100",
        property_name="Villa 100",
        current_owner_id="OWNER-1",
    )
    db = make_mock_db(prop=prop, share=share)

    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: db

    try:
        # Reading shared property details is permitted (200 OK)
        res = client.get("/api/v1/properties/PROP-100")
        assert res.status_code == 200
        assert res.json()["property_id"] == "PROP-100"
    finally:
        app.dependency_overrides.clear()
