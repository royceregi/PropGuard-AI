"""Phase 8b — Unit tests for Buyer Risk Assessment Requests & Evidence Reports (08-roles-and-permissions.md)."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.property import Property
from app.models.risk_assessment import RiskAssessmentRequest
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def mock_user(user_id: str = "BUYER-1", access_level: str = "PUBLIC") -> User:
    u = User()
    u.user_id = user_id
    u.access_level = access_level
    u.is_active = True
    u.role = "User"
    u.username = f"user_{user_id}"
    u.email = f"{user_id}@example.com"
    return u


def test_buyer_can_submit_risk_request_for_shared_property():
    buyer = mock_user("BUYER-1", "PUBLIC")
    prop = Property(
        property_id="PROP-200",
        current_owner_id="SELLER-1",
        property_name="Villa Shared",
        title_deed_number="TD-200",
    )

    db = MagicMock()
    # No active request exists for this property
    db.query.return_value.filter.return_value.first.return_value = None

    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: db

    try:
        with (
            patch("app.repositories.property_repository.get_property", return_value=prop),
            patch(
                "app.repositories.property_repository.user_can_access_property", return_value=True
            ),
            patch("app.services.risk_assessment_service.compute_system_checks") as mock_checks,
        ):
            mock_checks.return_value = {
                "signals": [
                    {"code": "blockchain", "status": "PASS", "weight": 0, "detail": "Verified"}
                ],
                "suggested_score": 15,
                "suggested_level": "LOW",
            }

            res = client.post(
                "/api/v1/risk-assessments/",
                json={
                    "property_id": "PROP-200",
                    "notes": "Buyer pre-purchase check",
                    "include_evidence": True,
                },
            )
            assert res.status_code == 201
            data = res.json()
            assert data["property_id"] == "PROP-200"
            assert data["requester"]["user_id"] == "BUYER-1"
            assert data["include_evidence"] is True
    finally:
        app.dependency_overrides.clear()


def test_buyer_cannot_request_unshared_property():
    buyer = mock_user("BUYER-1", "PUBLIC")
    prop = Property(property_id="PROP-999", current_owner_id="OTHER-1")

    db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: db

    try:
        with (
            patch("app.repositories.property_repository.get_property", return_value=prop),
            patch(
                "app.repositories.property_repository.user_can_access_property", return_value=False
            ),
        ):
            res = client.post(
                "/api/v1/risk-assessments/",
                json={"property_id": "PROP-999", "notes": "Unauthorized check"},
            )
            assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_buyer_can_view_own_risk_request_detail():
    buyer = mock_user("BUYER-1", "PUBLIC")
    req = RiskAssessmentRequest(
        request_id="RAR-100",
        property_id="PROP-200",
        requester_id="BUYER-1",
        requester_access_level="PUBLIC",
        status="SUBMITTED",
        include_evidence=True,
        submitted_snapshot={"property_name": "Villa Shared"},
        verification_checks={},
        history=[],
        submitted_at=datetime.now(),
    )

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = req

    app.dependency_overrides[get_current_user] = lambda: buyer
    app.dependency_overrides[get_db] = lambda: db

    try:
        with patch(
            "app.repositories.property_repository.user_can_access_property", return_value=True
        ):
            res = client.get("/api/v1/risk-assessments/RAR-100")
            assert res.status_code == 200
            data = res.json()
            assert data["request_id"] == "RAR-100"
            assert data["property_id"] == "PROP-200"
            assert data["is_own_request"] is True
    finally:
        app.dependency_overrides.clear()
