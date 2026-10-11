"""Role access control and Phase 7 analytics/investigation endpoint unit tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.api.deps import get_current_user, get_db
from app.main import app
from app.models.user import User
from fastapi.testclient import TestClient

client = TestClient(app)


def mock_user(user_id: str = "USR-001", access_level: str = "PUBLIC") -> User:
    u = User()
    u.user_id = user_id
    u.access_level = access_level
    u.is_active = True
    u.role = "User"
    return u


def mock_db_session():
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []
    db.query.return_value.order_by.return_value.limit.return_value.all.return_value = []
    return db


def test_public_user_analytics_forbidden():
    user = mock_user("USR-001", "PUBLIC")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        res = client.get("/api/v1/analytics/dashboard")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_company_analytics_hides_recent_queries():
    user = mock_user("USR-002", "COMPANY")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        with patch("app.services.analytics_service.get_dashboard_analytics") as mock_stats:
            mock_stats.return_value = {"summary": {"total_transactions": 10}}
            res = client.get("/api/v1/analytics/dashboard")
            assert res.status_code == 200
            assert res.json()["summary"]["total_transactions"] == 10
            assert mock_stats.call_args.kwargs["include_recent_queries"] is False
    finally:
        app.dependency_overrides.clear()


def test_admin_agent_runs_forbidden_for_public():
    user = mock_user("USR-001", "PUBLIC")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        res = client.get("/api/v1/investigations/agent-runs")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_agent_runs_allowed_for_registry():
    user = mock_user("USR-REG", "REGISTRY")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        res = client.get("/api/v1/investigations/agent-runs")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
    finally:
        app.dependency_overrides.clear()


def test_run_investigation_endpoint():
    user = mock_user("USR-REG", "REGISTRY")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        with (
            patch("app.api.v1.endpoints.investigations.ensure_transaction_access"),
            patch("app.agents.orchestrator.investigate") as mock_inv,
        ):
            mock_inv.return_value = {
                "query_id": "INV-12345",
                "transaction_id": "TX100",
                "assessment": {"risk_level": "LOW"},
                "report": {"executive_summary": "Clean transaction."},
                "agents": [],
            }
            res = client.post("/api/v1/investigations/TX100")
            assert res.status_code == 200
            data = res.json()
            assert data["query_id"] == "INV-12345"
            assert data["report"]["executive_summary"] == "Clean transaction."
    finally:
        app.dependency_overrides.clear()


def test_investigation_not_found():
    user = mock_user("USR-REG", "REGISTRY")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = mock_db_session

    try:
        with (
            patch("app.api.v1.endpoints.investigations.ensure_transaction_access"),
            patch("app.agents.orchestrator.investigate") as mock_inv,
        ):
            mock_inv.return_value = None
            res = client.post("/api/v1/investigations/TX_NONE")
            assert res.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_get_investigation_by_query_id():
    user = mock_user("USR-REG", "REGISTRY")
    app.dependency_overrides[get_current_user] = lambda: user

    db = MagicMock()
    mock_log = MagicMock()
    mock_log.query_id = "INV-CA142E40"
    mock_log.user_id = "SYS000001"
    mock_log.query_text = "investigate:1-41-2023-5616"
    mock_log.agent_used = "orchestrator"
    mock_log.confidence_score = 0.67
    mock_log.relevance_score = 0.85
    mock_log.flagged_suspicious = False
    mock_log.response_time_ms = 8498
    mock_log.agent_response = "Clean title check."
    mock_log.log_timestamp = None

    db.query.return_value.filter.return_value.first.return_value = mock_log
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
    app.dependency_overrides[get_db] = lambda: db

    try:
        res = client.get("/api/v1/investigations/query/INV-CA142E40")
        assert res.status_code == 200
        data = res.json()
        assert data["query_id"] == "INV-CA142E40"
        assert data["user_id"] == "SYS000001"
        assert data["confidence_score"] == 0.67

        # Test alias endpoint
        res_alias = client.get("/api/v1/investigations/INV-CA142E40")
        assert res_alias.status_code == 200
        assert res_alias.json()["query_id"] == "INV-CA142E40"
    finally:
        app.dependency_overrides.clear()
