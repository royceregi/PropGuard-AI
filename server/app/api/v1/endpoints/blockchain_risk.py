from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents import retrieval_agent, risk_agent
from app.api.deps import require_roles
from app.api.property_access import ensure_transaction_access
from app.core.database import get_db
from app.models.user import User as UserModel
from app.schemas.blockchain_risk import (
    AgentOutput,
    BlockchainInvestigationResponse,
    BlockchainRiskAssessment,
)
from app.services import blockchain_risk_service

router = APIRouter()

# Read-only for official records: assessments only add rows to risk tables.
RISK_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]


@router.post("/risk/{transaction_id}", response_model=BlockchainInvestigationResponse)
def investigate_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(RISK_ROLES)),
):
    """Retrieval Agent → Risk Agent: verify the ledger, store features, assessment, and indicators."""
    ensure_transaction_access(db, current_user, transaction_id)
    result = risk_agent.investigate(db, transaction_id.strip())
    if result is None:
        raise HTTPException(status_code=404, detail="No blockchain record for this transaction")
    return result


@router.get("/risk/{transaction_id}", response_model=BlockchainRiskAssessment)
def latest_assessment(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(RISK_ROLES)),
):
    ensure_transaction_access(db, current_user, transaction_id)
    assessment = blockchain_risk_service.get_latest_assessment(db, transaction_id.strip())
    if assessment is None:
        raise HTTPException(status_code=404, detail="No blockchain risk assessment yet")
    return assessment


@router.get("/evidence/{transaction_id}", response_model=AgentOutput)
def retrieval_evidence(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(RISK_ROLES)),
):
    """Retrieval Agent only: blockchain verification result as evidence JSON (no assessment stored)."""
    ensure_transaction_access(db, current_user, transaction_id)
    output, evaluation = retrieval_agent.run(db, transaction_id.strip())
    if evaluation is None:
        raise HTTPException(status_code=404, detail="No blockchain record for this transaction")
    return output
