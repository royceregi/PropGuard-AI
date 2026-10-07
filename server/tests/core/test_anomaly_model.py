import random

import pytest

pytest.importorskip("sklearn")

from app.services import anomaly_model_service as anomaly
from app.services.blockchain_risk_service import _anomaly_indicators, _model_version


def _row(rng: random.Random, **overrides):
    row = {
        "price_per_area": rng.uniform(9000, 13000),
        "price_deviation_from_area_median": rng.uniform(-15, 15),
        "ownership_change_count": rng.randint(40, 80),
        "transactions_last_90_days": rng.randint(0, 2),
        "transactions_last_365_days": rng.randint(0, 4),
        "days_since_previous_transaction": rng.choice([None, rng.randint(100, 400)]),
        "value_change_pct": rng.uniform(-10, 10),
    }
    row.update(overrides)
    return row


@pytest.fixture(scope="module")
def bundle():
    rng = random.Random(7)
    return anomaly.fit([_row(rng) for _ in range(500)], contamination=0.02)


def test_typical_row_is_not_anomalous(bundle):
    result = anomaly.score_row(bundle, _row(random.Random(99)))
    assert result["is_anomaly"] is False
    assert 0.0 <= result["anomaly_score"] < 0.9


def test_extreme_row_is_anomalous_with_evidence(bundle):
    row = _row(
        random.Random(1),
        price_per_area=900000,
        price_deviation_from_area_median=5000,
        transactions_last_90_days=150,
        transactions_last_365_days=300,
        value_change_pct=250000,
    )
    result = anomaly.score_row(bundle, row)
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] >= 0.99
    assert 0 < len(result["unusual_features"]) <= anomaly.MAX_EVIDENCE
    assert all(abs(item["robust_z"]) >= anomaly.EVIDENCE_Z for item in result["unusual_features"])


def test_missing_values_use_training_medians(bundle):
    row = {column: None for column, _ in anomaly.FEATURES}
    result = anomaly.score_row(bundle, row)
    assert result["unusual_features"] == []


def test_indicator_only_for_anomalies(bundle):
    extreme = anomaly.score_row(
        bundle, _row(random.Random(1), price_per_area=900000, value_change_pct=250000)
    )
    [indicator] = _anomaly_indicators("TX1", extreme)
    assert indicator["indicator_code"] == anomaly.INDICATOR_CODE
    assert indicator["severity"] == "MEDIUM"
    assert indicator["source"] == "anomaly_model"
    assert indicator["evidence"][0]["table"] == "transaction_features"
    assert _anomaly_indicators("TX1", {**extreme, "is_anomaly": False}) == []
    assert _anomaly_indicators("TX1", None) == []


def test_model_version_names_anomaly_model(bundle):
    result = anomaly.score_row(bundle, _row(random.Random(3)))
    assert _model_version(None) == "1.0"
    assert _model_version(result) == "1.0+isolation-forest-1.0"


def test_fit_rejects_tiny_dataset():
    with pytest.raises(ValueError):
        anomaly.fit([_row(random.Random(0))], contamination=0.01)


def test_fit_keeps_most_unusual_rows_with_ids():
    rng = random.Random(11)
    rows = [{**_row(rng), "transaction_id": f"TX{i}", "property_id": "P1"} for i in range(300)]
    rows[5].update(price_per_area=900000, value_change_pct=250000)
    bundle = anomaly.fit(rows, contamination=0.02)
    assert bundle["flagged_total"] == len(bundle["top_flagged"]) > 0
    assert bundle["top_flagged"][0]["transaction_id"] == "TX5"
    scores = [item["anomaly_score"] for item in bundle["top_flagged"]]
    assert scores == sorted(scores, reverse=True)
