"""Minimal client for OpenAI-compatible chat APIs (OpenRouter, OpenAI, Ollama /v1)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def model_for(agent_name: str | None = None) -> str:
    """Return an agent-specific model, falling back to the shared model."""
    model_settings = {
        "blockchain_retrieval_agent": "AI_RETRIEVAL_MODEL",
        "transaction_analysis_agent": "AI_TRANSACTION_ANALYSIS_MODEL",
        "risk_detection_agent": "AI_RISK_MODEL",
        "report_agent": "AI_REPORT_MODEL",
    }
    setting_name = model_settings.get(agent_name or "")
    configured_model = getattr(settings, setting_name, "") if setting_name else ""
    return configured_model.strip() or settings.AI_MODEL


def is_enabled() -> bool:
    return bool(
        settings.AI_ENABLED
        and settings.AI_BASE_URL
        and (settings.AI_API_KEY or settings.AI_PROVIDER == "ollama")
    )


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.AI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.AI_API_KEY}"
    if settings.AI_PROVIDER == "openrouter":
        # Optional attribution headers shown on the OpenRouter dashboard.
        headers["HTTP-Referer"] = settings.FRONTEND_URL
        headers["X-Title"] = "PropGuard-AI"
    return headers


def _parse_json(content: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise LLMError("Model did not return JSON")
    try:
        parsed = json.loads(match.group(0))
    except ValueError as exc:
        raise LLMError(f"Model returned invalid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise LLMError("Model JSON is not an object")
    return parsed


def chat_json(
    system: str,
    user: str,
    *,
    model: str | None = None,
    agent_name: str | None = None,
) -> dict[str, Any]:
    """Send one system + user message and return the model's JSON object reply."""
    if not is_enabled():
        raise LLMError("AI is disabled")
    payload = {
        "model": model or model_for(agent_name),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": settings.AI_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }
    url = settings.AI_BASE_URL.rstrip("/") + "/chat/completions"
    try:
        response = httpx.post(
            url, json=payload, headers=_headers(), timeout=settings.AI_TIMEOUT_SECONDS
        )
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM request failed: {exc.__class__.__name__}") from exc
    if response.status_code != 200:
        logger.warning("LLM HTTP %s: %s", response.status_code, response.text[:500])
        raise LLMError(f"LLM returned HTTP {response.status_code}")
    try:
        content = response.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise LLMError("Unexpected LLM response shape") from exc
    return _parse_json(content)
