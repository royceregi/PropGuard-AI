"""Optional unsupervised anomaly model (Isolation Forest) over historical transaction features.

The dataset did not provide verified fraud labels, so the demonstration uses explainable rules and
unsupervised anomaly detection (06-risk-detection.md). This model only adds one indicator to the
rule score; it never replaces the rules, and on its own it cannot lift a transaction above LOW.

train()     → fit on core.transaction_features and save the model file (scripts/train_anomaly_model.py)
score()     → anomaly score for one transaction (None when disabled, untrained, or no feature row)
status()    → model metadata for the Anomaly Detection page; flagged() → most unusual transactions
indicator() → ANOMALOUS_TRANSACTION_PATTERN with the most unusual features as evidence

Off unless ANOMALY_MODEL_ENABLED=true and the model file exists. scikit-learn is imported lazily.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL_NAME = "isolation-forest"
MODEL_VERSION = "1.0"
INDICATOR_CODE = "ANOMALOUS_TRANSACTION_PATTERN"
INDICATOR_WEIGHT = 0.2  # MEDIUM severity; below the 0.40 MEDIUM risk level on its own
EVIDENCE_Z = 2.0  # robust z-score a feature needs to be cited as evidence
MAX_EVIDENCE = 3
TOP_FLAGGED = 200  # most unusual training rows kept in the bundle for the Anomaly Detection page

# (column, transform). Features are heavy-tailed: "log" = log1p, "slog" = sign-preserving log1p.
FEATURES: tuple[tuple[str, str], ...] = (
    ("price_per_area", "log"),
    ("price_deviation_from_area_median", "slog"),
    ("ownership_change_count", "log"),
    ("transactions_last_90_days", "log"),
    ("transactions_last_365_days", "log"),
    ("days_since_previous_transaction", "log"),
    ("value_change_pct", "slog"),
)
FEATURE_LABELS = {
    "price_per_area": "Price per area",
    "price_deviation_from_area_median": "Price deviation from area median (%)",
    "ownership_change_count": "Ownership changes",
    "transactions_last_90_days": "Transactions in last 90 days",
    "transactions_last_365_days": "Transactions in last 365 days",
    "days_since_previous_transaction": "Days since previous transaction",
    "value_change_pct": "Value change (%)",
}
_COLUMNS = ", ".join(column for column, _ in FEATURES)

_cache: dict[str, Any] = {"key": None, "bundle": None}


def is_enabled() -> bool:
    return settings.ANOMALY_MODEL_ENABLED


def model_path() -> Path:
    path = Path(settings.ANOMALY_MODEL_PATH)
    return path if path.is_absolute() else Path(__file__).resolve().parents[2] / path


def _transform(value: Any, kind: str) -> float | None:
    if value is None:
        return None
    x = float(value)
    if kind == "log":
        return math.log1p(max(x, 0.0))
    return math.copysign(math.log1p(abs(x)), x)


def _vector(row: dict[str, Any], medians: list[float]) -> list[float]:
    """Transformed features (NULL → training median) plus a has-previous-transaction flag."""
    values = [_transform(row.get(column), kind) for column, kind in FEATURES]
    filled = [median if value is None else value for value, median in zip(values, medians)]
    return filled + [0.0 if row.get("days_since_previous_transaction") is None else 1.0]


def _quantile(sorted_values: list[float], q: float) -> float:
    index = (len(sorted_values) - 1) * q
    low, high = math.floor(index), math.ceil(index)
    return sorted_values[low] + (sorted_values[high] - sorted_values[low]) * (index - low)


def fit(
    rows: list[dict[str, Any]], *, contamination: float, random_state: int = 42
) -> dict[str, Any]:
    """Fit on feature rows (dicts keyed by FEATURES columns); return a model bundle."""
    import numpy as np
    from sklearn.ensemble import IsolationForest

    if len(rows) < 50:
        raise ValueError(f"Need at least 50 feature rows to train, got {len(rows)}")

    medians, scales, raw_medians = [], [], []
    for column, kind in FEATURES:
        raw = sorted(float(row[column]) for row in rows if row.get(column) is not None)
        transformed = [_transform(value, kind) for value in raw]
        values = sorted(v for v in transformed if v is not None)
        if not values:
            raw, values = [0.0], [0.0]
        iqr = _quantile(values, 0.75) - _quantile(values, 0.25)
        medians.append(_quantile(values, 0.5))
        scales.append(iqr / 1.349 if iqr > 0 else (float(np.std(values)) or 1.0))
        raw_medians.append(_quantile(raw, 0.5))

    matrix = np.array([_vector(row, medians) for row in rows], dtype=float)
    model = IsolationForest(
        n_estimators=200, contamination=contamination, random_state=random_state, n_jobs=-1
    ).fit(matrix)
    raw_scores = model.score_samples(matrix)
    flagged_idx = np.flatnonzero(model.decision_function(matrix) < 0)
    bundle = {
        "model": model,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "features": [column for column, _ in FEATURES],
        "medians": medians,
        "scales": scales,
        "raw_medians": raw_medians,
        "score_quantiles": np.quantile(raw_scores, np.linspace(0, 1, 1001)).tolist(),
        "contamination": contamination,
        "training_rows": len(rows),
        "flagged_total": int(len(flagged_idx)),
        "trained_at": datetime.now().isoformat(timespec="seconds"),
    }
    # Most unusual first; rows without a transaction_id (unit tests) are skipped.
    top = flagged_idx[np.argsort(raw_scores[flagged_idx])][:TOP_FLAGGED]
    bundle["top_flagged"] = [
        {
            "transaction_id": rows[i]["transaction_id"],
            "property_id": rows[i].get("property_id"),
            **{
                key: value
                for key, value in score_row(bundle, rows[i]).items()
                if key in ("anomaly_score", "unusual_features")
            },
        }
        for i in top
        if rows[i].get("transaction_id")
    ]
    return bundle


def train(
    db: Session, *, contamination: float | None = None, limit: int | None = None
) -> dict[str, Any]:
    """Fit on core.transaction_features and save the bundle to ANOMALY_MODEL_PATH."""
    import joblib

    sql = f"SELECT transaction_id, property_id, {_COLUMNS} FROM core.transaction_features ORDER BY feature_id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    rows = [dict(row) for row in db.execute(text(sql)).mappings()]
    bundle = fit(rows, contamination=contamination or settings.ANOMALY_CONTAMINATION)
    path = model_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, path)
    _cache.update(key=None, bundle=None)
    return {
        key: value
        for key, value in bundle.items()
        if key not in ("model", "score_quantiles", "top_flagged")
    } | {"path": str(path)}


def load() -> dict[str, Any] | None:
    """The saved bundle (cached by file mtime), or None when there is no model file."""
    path = model_path()
    if not path.exists():
        return None
    key = (str(path), path.stat().st_mtime)
    if _cache["key"] != key:
        import joblib

        _cache.update(key=key, bundle=joblib.load(path))
    return _cache["bundle"]


def score_row(bundle: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    """Score one feature row with a bundle. anomaly_score = share of training rows less unusual."""
    import bisect

    vector = _vector(row, bundle["medians"])
    model = bundle["model"]
    raw_score = float(model.score_samples([vector])[0])
    quantiles = bundle["score_quantiles"]
    # Lower score_samples = more abnormal; position among training quantiles gives the percentile.
    percentile = bisect.bisect_left(quantiles, raw_score) / (len(quantiles) - 1)
    anomaly_score = round(min(1.0, max(0.0, 1.0 - percentile)), 3)

    profile = []
    for index, (column, kind) in enumerate(FEATURES):
        value = row.get(column)
        transformed = _transform(value, kind)
        z = (
            None
            if transformed is None
            else (transformed - bundle["medians"][index]) / bundle["scales"][index]
        )
        profile.append(
            {
                "feature": column,
                "label": FEATURE_LABELS[column],
                "value": None if value is None else float(value),
                "typical": bundle["raw_medians"][index],
                "robust_z": None if z is None else round(z, 2),
            }
        )
    deviations = [
        item
        for item in profile
        if item["robust_z"] is not None and abs(item["robust_z"]) >= EVIDENCE_Z
    ]
    deviations.sort(key=lambda item: -abs(item["robust_z"]))
    return {
        "model_name": bundle["model_name"],
        "model_version": bundle["model_version"],
        "anomaly_score": anomaly_score,
        "is_anomaly": bool(model.decision_function([vector])[0] < 0),
        "contamination": bundle["contamination"],
        "unusual_features": deviations[:MAX_EVIDENCE],
        "profile": profile,
    }


def status() -> dict[str, Any]:
    """Whether the model is enabled and trained, with its training metadata."""
    info: dict[str, Any] = {
        "enabled": is_enabled(),
        "trained": False,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "features": [
            {"feature": column, "label": FEATURE_LABELS[column]} for column, _ in FEATURES
        ],
        "indicator_code": INDICATOR_CODE,
        "indicator_weight": INDICATOR_WEIGHT,
        "error": None,
    }
    try:
        bundle = load()
    except Exception as exc:
        return info | {"error": f"Model file could not be loaded: {exc}"}
    if bundle is None:
        return info
    return info | {
        "trained": True,
        "model_version": bundle["model_version"],
        "trained_at": bundle["trained_at"],
        "training_rows": bundle["training_rows"],
        "contamination": bundle["contamination"],
        "flagged_total": bundle.get("flagged_total"),
    }


def flagged(limit: int = 50) -> list[dict[str, Any]] | None:
    """Most unusual transactions from the last training run; None when untrained."""
    bundle = load()
    if bundle is None:
        return None
    return bundle.get("top_flagged", [])[:limit]


def score(
    db: Session, transaction_id: str, *, require_enabled: bool = True
) -> dict[str, Any] | None:
    """Score one transaction. require_enabled=False lets reviewers look up a score on demand."""
    if require_enabled and not is_enabled():
        return None
    try:
        bundle = load()
    except Exception as exc:  # corrupt file or scikit-learn missing: fall back to rules only
        logger.warning("Anomaly model unavailable: %s", exc)
        return None
    if bundle is None:
        if require_enabled:
            logger.warning(
                "ANOMALY_MODEL_ENABLED but no model at %s; run scripts/train_anomaly_model.py",
                model_path(),
            )
        return None
    row = (
        db.execute(
            text(f"SELECT {_COLUMNS} FROM core.transaction_features WHERE transaction_id = :tid"),
            {"tid": transaction_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        return None
    return score_row(bundle, dict(row))


def indicator(transaction_id: str, result: dict[str, Any]) -> dict[str, Any]:
    """Indicator fields (weight, description, evidence) for blockchain_risk_service._indicator."""
    pct = min(99, math.floor(result["anomaly_score"] * 100))
    evidence = [
        {
            "table": "transaction_features",
            "id": transaction_id,
            "field": item["feature"],
            "expected": f"typical ≈ {item['typical']:g}",
            "actual": f"{item['value']:g}",
        }
        for item in result["unusual_features"]
    ] or [
        {
            "table": "transaction_features",
            "id": transaction_id,
            "field": "anomaly_score",
            "expected": "typical pattern",
            "actual": result["anomaly_score"],
        }
    ]
    unusual = ", ".join(item["label"].lower() for item in result["unusual_features"])
    return {
        "code": INDICATOR_CODE,
        "name": "Unusual transaction pattern",
        "weight": INDICATOR_WEIGHT,
        "description": (
            f"The anomaly model ({result['model_name']}) rates this transaction more unusual than "
            f"{pct}% of registry transactions"
            + (f" (unusual: {unusual})." if unusual else ".")
            + " Unsupervised signal, not evidence of fraud."
        ),
        "evidence": evidence,
    }
