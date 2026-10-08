"""Unit tests for Phase 6 / Phase 9 AI agents (transaction analysis, report agent, orchestrator)."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.agents import (
    base,
    report_agent,
    transaction_analysis_agent,
)


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
