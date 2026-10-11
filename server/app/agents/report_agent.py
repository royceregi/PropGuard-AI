"""Report Agent (Phase 6 / Phase 9e).

Generates a structured investigation report combining outputs from:
1. Retrieval Agent (evidence)
2. Transaction Analysis Agent (registry & hash integrity checks)
3. Risk Agent (rules, indicators, risk level)

Sections included:
- verification_summary: ledger, document hash, ownership status
- risk_summary: risk score, risk level, indicator count
- findings: detailed indicators with evidence IDs
- supporting_data: transaction metadata, masked parties, values, dates, documents
- recommendation: actionable next steps
- responsible_ai_notice: standard disclaimers
- executive_summary: summary paragraph (template or LLM enhanced)
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import agent_output, log_run
from app.core import llm

AGENT_NAME = "report_agent"
MODEL = llm.model_for(AGENT_NAME)

RESPONSIBLE_AI_NOTICE = (
    "This is an automated risk indicator report generated for land-registry investigation purposes. "
    "It is not a legal fraud judgment or final legal determination."
)

BANNED_WORDS = ("fraudster", "guilty", "proven fraud", "criminal", "scammer")

_SYSTEM_PROMPT = """You are the Report Synthesis Agent of PropGuard AI, a land-registry verification system.

Given an investigation summary of a property transaction, rewrite the executive summary and recommendation.

Rules:
- Keep the factual findings strictly as provided. Do NOT invent new facts or accusations.
- This is a risk indicator, not a legal fraud judgment. Never claim fraud is proven or call anyone guilty.
- Provide clear, professional prose for a land-registry reviewer or buyer.

Reply only with a JSON object:
{
  "executive_summary": "2-3 clear sentences summarizing the investigation outcome",
  "recommendation": "1-3 clear sentences giving recommended next actions"
}"""


def _clean_banned(text: str) -> str:
    cleaned = text
    for word in BANNED_WORDS:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        cleaned = pattern.sub("[flagged term removed]", cleaned)
    return cleaned


def _build_template_report(
    retrieval_output: dict[str, Any],
    analysis_output: dict[str, Any],
    risk_output: dict[str, Any],
    assessment: dict[str, Any] | None,
) -> dict[str, Any]:
    ret_findings = (retrieval_output or {}).get("findings", {})
    ana_findings = (analysis_output or {}).get("findings", {})
    risk_findings = (risk_output or {}).get("findings", {})

    tx_id = ret_findings.get("transaction_id") or ana_findings.get("transaction_id") or "UNKNOWN"
    prop_id = ret_findings.get("property_id") or ana_findings.get("property_id")
    risk_level = (
        risk_findings.get("risk_level") or (assessment or {}).get("risk_level") or "UNKNOWN"
    )
    risk_score = risk_findings.get("risk_score") or (assessment or {}).get("risk_score") or 0.0

    hash_checks = ret_findings.get("hash_checks") or ana_findings.get("hash_findings") or {}
    registry_checks = ana_findings.get("checks") or []
    indicators = (assessment or {}).get("indicators") or []

    # Verification summary
    ledger_integrity = ret_findings.get("integrity") or (
        hash_checks.get("tx_hash_match") and hash_checks.get("previous_hash_match")
    )
    doc_match = hash_checks.get("document_hash_match")
    ownership_overall = ana_findings.get("overall", "UNKNOWN")

    verification_summary = {
        "ledger_record_exists": retrieval_output.get("status") != "NOT_FOUND",
        "ledger_integrity": "VALID" if ledger_integrity else "INVALID / UNVERIFIED",
        "document_hash_status": "MATCH"
        if doc_match is True
        else ("MISMATCH" if doc_match is False else "UNCHECKED"),
        "registry_checks_overall": ownership_overall,
    }

    # Findings
    formatted_findings = []
    if indicators:
        for ind in indicators:
            formatted_findings.append(
                {
                    "code": ind.get("indicator_code"),
                    "severity": ind.get("severity"),
                    "description": ind.get("description"),
                    "weight": ind.get("indicator_value"),
                    "evidence_ids": [
                        f"{ev.get('table')}:{ev.get('id')}"
                        for ev in ind.get("evidence", [])
                        if ev.get("table")
                    ],
                }
            )
    elif registry_checks:
        for chk in registry_checks:
            if chk.get("status") in ("FAIL", "WARN"):
                formatted_findings.append(
                    {
                        "code": chk.get("code"),
                        "severity": chk.get("status"),
                        "description": chk.get("reason"),
                        "weight": 0.0,
                        "evidence_ids": [
                            f"{ev.get('table')}:{ev.get('id')}"
                            for ev in chk.get("evidence", [])
                            if ev.get("table")
                        ],
                    }
                )

    # Supporting data
    supporting_data = {
        "transaction_id": tx_id,
        "property_id": prop_id,
        "chain_position": ret_findings.get("chain_position"),
        "is_chain_head": ret_findings.get("is_chain_head"),
        "documents": ret_findings.get("documents", []),
        "evidence_ids": list(
            set(
                (retrieval_output.get("evidence_ids") or [])
                + (analysis_output.get("evidence_ids") or [])
                + (risk_output.get("evidence_ids") or [])
            )
        ),
    }

    # Default executive summary & recommendation template
    if risk_level == "HIGH":
        exec_summary = (
            f"Investigation of transaction {tx_id} indicates HIGH risk (score: {risk_score:.2f}). "
            f"Multiple registry or hash consistency checks failed or flagged suspicious indicators."
        )
        recommendation = "Manual review by Land Registry officer is strongly recommended prior to final approval or transaction processing."
    elif risk_level == "MEDIUM":
        exec_summary = (
            f"Investigation of transaction {tx_id} indicates MEDIUM risk (score: {risk_score:.2f}). "
            f"Some minor discrepancies or data gaps were detected during verification."
        )
        recommendation = (
            "Review flagged warnings and confirm party identity and property registration details."
        )
    else:
        exec_summary = (
            f"Investigation of transaction {tx_id} indicates LOW risk (score: {risk_score:.2f}). "
            f"Ledger integrity and registry checks passed cleanly."
        )
        recommendation = "No adverse risk indicators found. Proceed with standard workflow."

    return {
        "report_id": f"REP-{tx_id}",
        "transaction_id": tx_id,
        "property_id": prop_id,
        "executive_summary": exec_summary,
        "risk_summary": {
            "risk_level": risk_level,
            "risk_score": float(risk_score),
            "indicator_count": len(indicators),
        },
        "verification_summary": verification_summary,
        "findings": formatted_findings,
        "supporting_data": supporting_data,
        "recommendation": recommendation,
        "responsible_ai_notice": RESPONSIBLE_AI_NOTICE,
        "generated_by": "template",
    }


def run(
    db: Session,
    retrieval_output: dict[str, Any],
    analysis_output: dict[str, Any],
    risk_output: dict[str, Any],
    assessment: dict[str, Any] | None,
    query_id: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Execute Report Agent.

    Returns (agent_output_dict, report_dict).
    """
    started = datetime.now()
    tx_id = (retrieval_output or {}).get("findings", {}).get("transaction_id", "UNKNOWN")
    input_data = {"transaction_id": tx_id}

    report = _build_template_report(retrieval_output, analysis_output, risk_output, assessment)
    warnings: list[str] = []

    # Optional LLM prose enhancement
    if llm.is_enabled():
        try:
            ctx = {
                "transaction_id": tx_id,
                "risk_level": report["risk_summary"]["risk_level"],
                "risk_score": report["risk_summary"]["risk_score"],
                "findings": report["findings"],
                "verification_summary": report["verification_summary"],
            }
            reply = llm.chat_json(
                _SYSTEM_PROMPT,
                f"Investigation Data:\n{json.dumps(ctx, default=str)}",
                model=MODEL,
                agent_name=AGENT_NAME,
            )
            exec_s = str(reply.get("executive_summary") or "").strip()
            recom = str(reply.get("recommendation") or "").strip()
            if exec_s:
                report["executive_summary"] = _clean_banned(exec_s)
            if recom:
                report["recommendation"] = _clean_banned(recom)
            report["generated_by"] = MODEL
        except Exception as exc:
            warnings.append(f"AI report generation unavailable, used template prose ({exc}).")

    confidence = min(
        retrieval_output.get("confidence_score", 1.0),
        analysis_output.get("confidence_score", 1.0),
        risk_output.get("confidence_score", 1.0),
    )

    all_evidence = list(
        set(
            (retrieval_output.get("evidence_ids") or [])
            + (analysis_output.get("evidence_ids") or [])
            + (risk_output.get("evidence_ids") or [])
        )
    )

    output = agent_output(
        AGENT_NAME,
        status="COMPLETED",
        confidence_score=confidence,
        findings={"report": report},
        evidence_ids=all_evidence,
        warnings=warnings,
    )
    log_run(
        db, AGENT_NAME, input_data=input_data, output=output, started_at=started, query_id=query_id
    )
    return output, report
