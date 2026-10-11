"""Unit tests for Phase 6 / Phase 9 AI agents (transaction analysis, report agent, orchestrator)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from app.agents import (
    base,
    orchestrator,
    report_agent,
    retrieval_agent,
    risk_agent,
    transaction_analysis_agent,
)
from app.api.v1.endpoints import investigations
from fastapi import HTTPException


def test_agent_output_structure():
    out = base.agent_output(
        "test_agent",
        status="COMPLETED",
        confidence_score=0.95,
        findings={"key": "val"},
        evidence_ids=["properties:1"],
        warnings=[],
    )
    assert out["agent_name"] == "test_agent"
    assert out["status"] == "COMPLETED"
    assert out["confidence_score"] == 0.95
    assert out["findings"] == {"key": "val"}
    assert out["evidence_ids"] == ["properties:1"]
    assert out["warnings"] == []


def test_transaction_analysis_agent_not_found():
    db = MagicMock()
    # Mock registry_checks_service returning None
    db.query.return_value.filter.return_value.first.return_value = None

    output, findings = transaction_analysis_agent.run(db, "NON_EXISTENT_TX")
    assert output["agent_name"] == "transaction_analysis_agent"
    assert output["status"] == "NOT_FOUND"
    assert output["confidence_score"] == 0.0


def test_report_agent_template_generation():
    db = MagicMock()
    retrieval_out = base.agent_output(
        "blockchain_retrieval_agent",
        status="COMPLETED",
        confidence_score=1.0,
        findings={"transaction_id": "TX100", "property_id": "PROP1", "integrity": "VALID"},
        evidence_ids=["blockchain_transactions:1"],
        warnings=[],
    )
    analysis_out = base.agent_output(
        "transaction_analysis_agent",
        status="COMPLETED",
        confidence_score=1.0,
        findings={"transaction_id": "TX100", "overall": "PASS", "checks": []},
        evidence_ids=["property_transactions:1"],
        warnings=[],
    )
    risk_out = base.agent_output(
        "risk_detection_agent",
        status="COMPLETED",
        confidence_score=1.0,
        findings={"risk_score": 0.1, "risk_level": "LOW"},
        evidence_ids=[],
        warnings=[],
    )
    assessment = {
        "transaction_id": "TX100",
        "risk_score": 0.1,
        "risk_level": "LOW",
        "indicators": [],
    }

    output, report = report_agent.run(db, retrieval_out, analysis_out, risk_out, assessment)

    assert output["agent_name"] == "report_agent"
    assert output["status"] == "COMPLETED"
    assert report["transaction_id"] == "TX100"
    assert report["risk_summary"]["risk_level"] == "LOW"
    assert "executive_summary" in report
    assert "recommendation" in report
    assert "responsible_ai_notice" in report


def test_banned_words_cleaning():
    raw_text = "The user is a fraudster and is guilty of proven fraud."
    cleaned = report_agent._clean_banned(raw_text)
    assert "fraudster" not in cleaned.lower()
    assert "guilty" not in cleaned.lower()
    assert "[flagged term removed]" in cleaned


def test_nvidia_nemotron_model_support():
    """Verify that NVIDIA Nemotron model configuration is supported."""
    from app.core.config import Settings

    # Test that the config accepts the NVIDIA Nemotron model
    settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/test",
        SECRET_KEY="test-key",
        AI_ENABLED=True,
        AI_PROVIDER="openrouter",
        AI_API_KEY="test-key",
        AI_MODEL="nvidia/nemotron-3-ultra-550b-a55b:free",
        AI_BASE_URL="https://openrouter.ai/api/v1",
    )

    assert settings.AI_MODEL == "nvidia/nemotron-3-ultra-550b-a55b:free"
    assert settings.AI_PROVIDER == "openrouter"
    assert settings.AI_BASE_URL == "https://openrouter.ai/api/v1"


def test_agent_models_are_independent_with_shared_fallback(monkeypatch):
    from app.core import llm

    monkeypatch.setattr(llm.settings, "AI_MODEL", "shared-model")
    monkeypatch.setattr(llm.settings, "AI_RETRIEVAL_MODEL", "retrieval-model")
    monkeypatch.setattr(llm.settings, "AI_TRANSACTION_ANALYSIS_MODEL", "")
    monkeypatch.setattr(llm.settings, "AI_RISK_MODEL", "risk-model")
    monkeypatch.setattr(llm.settings, "AI_REPORT_MODEL", "report-model")

    assert llm.model_for("blockchain_retrieval_agent") == "retrieval-model"
    assert llm.model_for("transaction_analysis_agent") == "shared-model"
    assert llm.model_for("risk_detection_agent") == "risk-model"
    assert llm.model_for("report_agent") == "report-model"


def test_chat_json_sends_explicit_model(monkeypatch):
    from app.core import llm

    response = MagicMock(status_code=200)
    response.json.return_value = {"choices": [{"message": {"content": '{"ok": true}'}}]}
    post = MagicMock(return_value=response)
    monkeypatch.setattr(llm.httpx, "post", post)
    monkeypatch.setattr(llm, "is_enabled", lambda: True)
    monkeypatch.setattr(llm.settings, "AI_BASE_URL", "https://example.test/v1")
    monkeypatch.setattr(llm.settings, "AI_TEMPERATURE", 0.2)
    monkeypatch.setattr(llm.settings, "AI_MAX_TOKENS", 100)
    monkeypatch.setattr(llm.settings, "AI_TIMEOUT_SECONDS", 10)

    assert llm.chat_json("system", "user", model="agent-model") == {"ok": True}
    assert post.call_args.kwargs["json"]["model"] == "agent-model"


# ─── Phase A: 4-agent pipeline integration ──────────────────────────────────


def _added(db: MagicMock, cls: type) -> list:
    return [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], cls)]


def test_log_run_stores_query_id():
    from app.models.risk_assessment import AgentRun

    db = MagicMock()
    base.log_run(
        db,
        "report_agent",
        input_data={"transaction_id": "TX1"},
        output={"status": "COMPLETED", "confidence_score": 0.8},
        started_at=base.datetime.now(),
        query_id="INV-TEST0001",
    )
    (run,) = _added(db, AgentRun)
    assert run.query_id == "INV-TEST0001"
    assert run.status == "COMPLETED"


def test_transaction_analysis_reuses_retrieval_registry_checks(monkeypatch):
    def fail(*_args, **_kwargs):
        raise AssertionError("registry checks must not run twice")

    monkeypatch.setattr(transaction_analysis_agent.registry_checks_service, "run_checks", fail)
    logged: dict = {}
    monkeypatch.setattr(transaction_analysis_agent, "log_run", lambda *a, **kw: logged.update(kw))
    evaluation = {
        "registry_checks": {
            "property_id": "P1",
            "overall": "WARN",
            "counts": {"PASS": 1, "WARN": 1},
            "checks": [
                {
                    "code": "OWN-1",
                    "name": "Seller is owner",
                    "category": "ownership",
                    "status": "PASS",
                    "reason": "ok",
                    "evidence": [{"table": "properties", "id": "P1"}],
                },
                {
                    "code": "VAL-1",
                    "name": "Value check",
                    "category": "value",
                    "status": "WARN",
                    "reason": "low",
                    "evidence": [],
                },
            ],
        }
    }

    output, findings = transaction_analysis_agent.run(
        MagicMock(), "TX1", evaluation=evaluation, query_id="INV-1"
    )

    assert output["status"] == "COMPLETED"
    assert findings["property_id"] == "P1"
    assert findings["ownership_findings"][0]["code"] == "OWN-1"
    assert output["evidence_ids"] == ["properties:P1"]
    assert logged["query_id"] == "INV-1"


def _fake_out(name: str, evidence: list[str]) -> dict:
    return base.agent_output(
        name,
        status="COMPLETED",
        confidence_score=0.9,
        findings={},
        evidence_ids=evidence,
        warnings=[],
    )


def test_orchestrator_runs_four_agents_in_order_with_shared_query_id(monkeypatch):
    from app.models.retrieval import QueryLog, QueryRetrieval

    calls: list[tuple[str, str | None]] = []
    evaluation = {"transaction_id": "TX1", "registry_checks": None}

    def fake_retrieval(db, tid, query_id=None):
        # core.agent_runs.query_id is a FK to query_logs: the parent row must already be committed.
        assert [a.query_id for a in _added(db, QueryLog)] == ["INV-ABC"]
        db.commit.assert_called()
        calls.append(("retrieval", query_id))
        return _fake_out(retrieval_agent.AGENT_NAME, ["blockchain_transactions:9"]), evaluation

    def fake_analysis(db, tid, retrieval_output=None, evaluation=None, query_id=None):
        calls.append(("analysis", query_id))
        return _fake_out(transaction_analysis_agent.AGENT_NAME, ["property_documents:5"]), {}

    def fake_risk(db, retrieval_output, evaluation, query_id=None):
        calls.append(("risk", query_id))
        return _fake_out(risk_agent.AGENT_NAME, []), {"risk_level": "HIGH", "risk_score": 0.8}

    def fake_report(db, r, a, k, assessment, query_id=None):
        calls.append(("report", query_id))
        out = _fake_out(
            report_agent.AGENT_NAME,
            ["blockchain_transactions:9", "property_transactions:TX1", "property_documents:5"],
        )
        return out, {"executive_summary": "High risk summary."}

    monkeypatch.setattr(retrieval_agent, "run", fake_retrieval)
    monkeypatch.setattr(transaction_analysis_agent, "run", fake_analysis)
    monkeypatch.setattr(risk_agent, "run", fake_risk)
    monkeypatch.setattr(report_agent, "run", fake_report)

    db = MagicMock()
    result = orchestrator.investigate(db, " TX1 ", query_id="INV-ABC")

    assert result is not None
    assert [name for name, _ in calls] == ["retrieval", "analysis", "risk", "report"]
    assert {qid for _, qid in calls} == {"INV-ABC"}

    (log,) = _added(db, QueryLog)
    assert log.query_id == "INV-ABC"
    assert log.user_id is None
    assert log.query_text == "investigate:TX1"
    assert log.agent_response == "High risk summary."
    assert log.flagged_suspicious is True

    retrievals = _added(db, QueryRetrieval)
    assert {(r.transaction_id, r.document_id) for r in retrievals} == {("TX1", None), (None, 5)}
    db.commit.assert_called()


def test_orchestrator_stops_when_transaction_not_found(monkeypatch):
    not_found = base.agent_output(
        retrieval_agent.AGENT_NAME,
        status="NOT_FOUND",
        confidence_score=0,
        findings={},
        evidence_ids=[],
        warnings=[],
    )
    monkeypatch.setattr(retrieval_agent, "run", lambda db, tid, query_id=None: (not_found, None))
    monkeypatch.setattr(report_agent, "run", MagicMock(side_effect=AssertionError("must not run")))
    db = MagicMock()

    assert orchestrator.investigate(db, "MISSING") is None
    from app.models.retrieval import QueryLog, QueryRetrieval

    (log,) = _added(db, QueryLog)
    assert log.agent_response == "No blockchain ledger record found for transaction MISSING."
    assert _added(db, QueryRetrieval) == []


def test_orchestrator_leaves_runs_unlinked_when_parent_log_fails(monkeypatch):
    seen: list[str | None] = []

    def fake_retrieval(db, tid, query_id=None):
        seen.append(query_id)
        return _fake_out(retrieval_agent.AGENT_NAME, []), {"transaction_id": tid}

    monkeypatch.setattr(retrieval_agent, "run", fake_retrieval)
    monkeypatch.setattr(
        transaction_analysis_agent,
        "run",
        lambda db, tid, retrieval_output=None, evaluation=None, query_id=None: (
            seen.append(query_id) or _fake_out(transaction_analysis_agent.AGENT_NAME, []),
            {},
        ),
    )
    monkeypatch.setattr(
        risk_agent,
        "run",
        lambda db, r, e, query_id=None: (
            seen.append(query_id) or _fake_out(risk_agent.AGENT_NAME, []),
            None,
        ),
    )
    monkeypatch.setattr(
        report_agent,
        "run",
        lambda db, r, a, k, s, query_id=None: (
            seen.append(query_id) or _fake_out(report_agent.AGENT_NAME, []),
            {},
        ),
    )
    db = MagicMock()
    db.commit.side_effect = [RuntimeError("duplicate key"), None, None]

    assert orchestrator.investigate(db, "TX1", query_id="INV-DUP") is not None
    assert seen == [None, None, None, None]


def test_reported_investigation_ids_only_counts_report_runs():
    db = MagicMock()
    db.query.return_value.filter.return_value.distinct.return_value.all.return_value = [("INV-1",)]
    assert orchestrator.reported_investigation_ids(db, ["INV-1", "INV-2"]) == {"INV-1"}
    assert orchestrator.reported_investigation_ids(MagicMock(), []) == set()


def test_stored_report_reads_report_agent_run():
    db = MagicMock()
    run = SimpleNamespace(output_data={"findings": {"report": {"report_id": "REP-TX1"}}})
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = run
    assert orchestrator.stored_report(db, "INV-1") == {"report_id": "REP-TX1"}

    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None
    assert orchestrator.stored_report(db, "INV-2") is None


def _investigation_db(owner: str) -> MagicMock:
    db = MagicMock()
    chain = db.query.return_value.filter.return_value
    chain.first.return_value = SimpleNamespace(
        query_id="INV-1",
        user_id=owner,
        query_text="investigate:TX1",
        agent_used="orchestrator",
        confidence_score=None,
        relevance_score=None,
        flagged_suspicious=False,
        response_time_ms=10,
        agent_response="summary",
        log_timestamp=None,
    )
    chain.order_by.return_value.all.return_value = []
    chain.order_by.return_value.first.return_value = SimpleNamespace(
        output_data={"findings": {"report": {"report_id": "REP-TX1"}}}
    )
    return db


def test_public_user_cannot_read_another_users_investigation():
    user = SimpleNamespace(user_id="U1", access_level="PUBLIC")
    with pytest.raises(HTTPException) as exc:
        investigations.get_investigation_by_query_id(
            query_id="INV-1", db=_investigation_db(owner="U2"), current_user=user
        )
    assert exc.value.status_code == 404


def test_investigation_detail_returns_stored_report_to_owner_and_authority():
    owner = SimpleNamespace(user_id="U1", access_level="PUBLIC")
    admin = SimpleNamespace(user_id="A1", access_level="SYSTEM")
    for user in (owner, admin):
        data = investigations.get_investigation_by_query_id(
            query_id="INV-1", db=_investigation_db(owner="U1"), current_user=user
        )
        assert data["report"] == {"report_id": "REP-TX1"}


def test_investigation_list_is_scoped_for_public_users():
    public = SimpleNamespace(user_id="U1", access_level="PUBLIC")
    admin = SimpleNamespace(user_id="A1", access_level="SYSTEM")

    db = MagicMock()
    investigations.list_investigations(limit=10, offset=0, db=db, current_user=public)
    assert db.query.return_value.filter.return_value.filter.called

    db = MagicMock()
    investigations.list_investigations(limit=10, offset=0, db=db, current_user=admin)
    assert not db.query.return_value.filter.return_value.filter.called
