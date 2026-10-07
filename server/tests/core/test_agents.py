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
