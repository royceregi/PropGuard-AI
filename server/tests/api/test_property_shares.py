"""Phase 8a — Unit tests for Seller -> Buyer Property Sharing (08-roles-and-permissions.md)."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.property import Property, PropertyShare
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def mock_user(user_id: str, access_level: str = "PUBLIC") -> User:
    u = User()
    u.user_id = user_id
    u.access_level = access_level
    u.is_active = True
    u.role = "User"
    u.username = f"user_{user_id}"
    u.email = f"{user_id}@example.com"
    return u


def make_mock_db(
    prop: Property | None = None, buyer: User | None = None, share: PropertyShare | None = None
):
    db = MagicMock()

    def query_side_effect(model):
        m = MagicMock()
        if model == Property:
            m.filter.return_value.first.return_value = prop
        elif model == User:
            m.filter.return_value.first.return_value = buyer
        elif model == PropertyShare:
            m.filter.return_value.first.return_value = share
            m.filter.return_value.all.return_value = [share] if share else []
            m.filter.return_value.filter.return_value.order_by.return_value.all.return_value = (
                [share] if share else []
            )
            m.filter.return_value.order_by.return_value.all.return_value = [share] if share else []
        return m

    db.query.side_effect = query_side_effect
    return db


def test_owner_can_share_property():
    owner = mock_user("OWNER-1", "PUBLIC")
    buyer = mock_user("BUYER-1", "PUBLIC")
    prop = Property(property_id="PROP-100", current_owner_id="OWNER-1", property_name="Villa 100")

    db = make_mock_db(prop=prop, buyer=buyer)

    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.post(
            "/api/v1/properties/PROP-100/shares",
            json={
                "buyer_user_id": "BUYER-1",
                "notes": "Please review before offer",
                "expires_in_days": 30,
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["owner_user_id"] == "OWNER-1"
        assert data["buyer_user_id"] == "BUYER-1"
        assert data["is_active"] is True
    finally:
        app.dependency_overrides.clear()


def test_non_owner_cannot_share_property():
    other_user = mock_user("OTHER-1", "PUBLIC")
    prop = Property(property_id="PROP-100", current_owner_id="OWNER-1")

    db = make_mock_db(prop=prop)

    app.dependency_overrides[get_current_user] = lambda: other_user
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.post(
            "/api/v1/properties/PROP-100/shares",
            json={"buyer_user_id": "BUYER-1"},
        )
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_buyer_received_shares_inbox():
    buyer = mock_user("BUYER-1", "PUBLIC")
    share = PropertyShare(
        share_id="SHR-1",
        property_id="PROP-100",
        owner_user_id="OWNER-1",
        buyer_user_id="BUYER-1",
        created_at=datetime.now(),
        expires_at=None,
        revoked_at=None,
    )

    db = make_mock_db(share=share)

    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.get("/api/v1/shares/received")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["share_id"] == "SHR-1"
    finally:
        app.dependency_overrides.clear()


def test_owner_can_revoke_share():
    owner = mock_user("OWNER-1", "PUBLIC")
    share = PropertyShare(
        share_id="SHR-1",
        property_id="PROP-100",
        owner_user_id="OWNER-1",
        buyer_user_id="BUYER-1",
        created_at=datetime.now(),
        revoked_at=None,
    )

    db = make_mock_db(share=share)

    app.dependency_overrides[get_current_user] = lambda: owner
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.delete("/api/v1/properties/PROP-100/shares/SHR-1")
        assert res.status_code == 200
        data = res.json()
        assert data["share_id"] == "SHR-1"
        assert data["is_active"] is False
    finally:
        app.dependency_overrides.clear()
