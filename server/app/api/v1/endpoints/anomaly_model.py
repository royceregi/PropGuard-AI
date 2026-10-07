"""Anomaly Detection page: model status, most unusual transactions, on-demand scoring, retraining."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.property import PropertyTransaction
from app.models.user import User as UserModel
from app.schemas.anomaly_model import (
    AnomalyModelStatus,
    AnomalyScore,
    AnomalyTrainRequest,
    AnomalyTrainResponse,
    FlaggedTransactions,
)
from app.services import anomaly_model_service

router = APIRouter()

REVIEW_ROLES = ["SYSTEM", "REGISTRY"]
ADMIN_ROLES = ["SYSTEM"]


def _require_trained() -> None:
    try:
        trained = anomaly_model_service.load() is not None
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail=f"Anomaly model could not be loaded: {exc}"
        ) from exc
    if not trained:
        raise HTTPException(status_code=409, detail="The anomaly model has not been trained yet")


@router.get("/status", response_model=AnomalyModelStatus)
def model_status(_: UserModel = Depends(require_roles(REVIEW_ROLES))):
    return anomaly_model_service.status()


@router.get("/flagged", response_model=FlaggedTransactions)
def flagged_transactions(
    limit: int = Query(50, ge=1, le=anomaly_model_service.TOP_FLAGGED),
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(REVIEW_ROLES)),
):
    """Most unusual transactions from the last training run, with registry details."""
    _require_trained()
    items = anomaly_model_service.flagged(limit) or []
    details = {
        row.transaction_id: row
        for row in db.query(
            PropertyTransaction.transaction_id,
            PropertyTransaction.transaction_group,
            PropertyTransaction.transaction_datetime,
            PropertyTransaction.transaction_value,
            PropertyTransaction.area_name,
        ).filter(PropertyTransaction.transaction_id.in_([item["transaction_id"] for item in items]))
    }
    enriched = []
    for item in items:
        row = details.get(item["transaction_id"])
        enriched.append(
            {
                **item,
                "transaction_group": row.transaction_group if row else None,
                "transaction_datetime": row.transaction_datetime if row else None,
                "transaction_value": float(row.transaction_value)
                if row and row.transaction_value is not None
                else None,
                "area_name": row.area_name if row else None,
            }
        )
    return {"total": anomaly_model_service.status().get("flagged_total") or 0, "items": enriched}


@router.get("/score/{transaction_id}", response_model=AnomalyScore)
def score_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(REVIEW_ROLES)),
):
    """Score one transaction now (works even when assessments do not use the model yet)."""
    _require_trained()
    tid = transaction_id.strip()
    result = anomaly_model_service.score(db, tid, require_enabled=False)
    if result is None:
        raise HTTPException(status_code=404, detail="No feature row for this transaction")
    return {"transaction_id": tid, **result}


@router.post("/train", response_model=AnomalyTrainResponse)
def train_model(
    body: AnomalyTrainRequest,
    db: Session = Depends(get_db),
    _: UserModel = Depends(require_roles(ADMIN_ROLES)),
):
    """Retrain on every transaction_features row (about 10 s for the full dataset)."""
    try:
        return anomaly_model_service.train(db, contamination=body.contamination)
    except ImportError as exc:
        raise HTTPException(
            status_code=503, detail="scikit-learn is not installed on the server"
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
