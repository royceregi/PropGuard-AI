from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AnomalyFeature(BaseModel):
    feature: str
    label: str


class AnomalyModelStatus(BaseModel):
    enabled: bool = Field(
        description="ANOMALY_MODEL_ENABLED: whether risk assessments use the model"
    )
    trained: bool
    model_name: str
    model_version: str
    features: list[AnomalyFeature]
    indicator_code: str
    indicator_weight: float
    trained_at: datetime | None = None
    training_rows: int | None = None
    contamination: float | None = None
    flagged_total: int | None = None
    error: str | None = None


class FeatureDeviation(BaseModel):
    feature: str
    label: str
    value: float | None = None
    typical: float
    robust_z: float | None = None


class FlaggedTransaction(BaseModel):
    transaction_id: str
    property_id: str | None = None
    anomaly_score: float
    unusual_features: list[FeatureDeviation] = Field(default_factory=list)
    transaction_group: str | None = None
    transaction_datetime: datetime | None = None
    transaction_value: float | None = None
    area_name: str | None = None


class FlaggedTransactions(BaseModel):
    total: int = Field(description="Transactions flagged at training time")
    items: list[FlaggedTransaction]


class AnomalyScore(BaseModel):
    transaction_id: str
    model_name: str
    model_version: str
    anomaly_score: float = Field(
        description="0–1: share of registry transactions that are less unusual"
    )
    is_anomaly: bool
    contamination: float
    unusual_features: list[FeatureDeviation] = Field(default_factory=list)
    profile: list[FeatureDeviation] = Field(default_factory=list)


class AnomalyTrainRequest(BaseModel):
    contamination: float | None = Field(default=None, gt=0, le=0.2)


class AnomalyTrainResponse(BaseModel):
    model_name: str
    model_version: str
    training_rows: int
    contamination: float
    flagged_total: int
    trained_at: datetime
