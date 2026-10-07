import pytest
from app.services.blockchain_risk_service import _severity, risk_level


@pytest.mark.parametrize(
    ("score", "level"),
    [
        (0.0, "LOW"),
        (0.39, "LOW"),
        (0.40, "MEDIUM"),
        (0.69, "MEDIUM"),
        (0.70, "HIGH"),
        (1.0, "HIGH"),
    ],
)
def test_risk_level_boundaries(score, level):
    assert risk_level(score) == level


@pytest.mark.parametrize(
    ("weight", "severity"),
    [(0.1, "LOW"), (0.2, "MEDIUM"), (0.39, "MEDIUM"), (0.4, "HIGH")],
)
def test_indicator_severity(weight, severity):
    assert _severity(weight) == severity
