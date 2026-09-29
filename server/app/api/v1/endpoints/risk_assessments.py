from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User as UserModel
from app.schemas.risk_assessment import (
    RegistryQueue,
    RegistryWorkspace,
    RequesterOverview,
    RequestStatus,
    RiskDraftUpdate,
    RiskRejectRequest,
    RiskRequestCreate,
    RiskRequestDetail,
    RiskVerifyRequest,
)
from app.services import risk_assessment_service as service

router = APIRouter()

# Super Admin (SYSTEM) is intentionally excluded from every risk assessment route.
REQUESTER_ROLES = ["PUBLIC", "COMPANY"]
REGISTRY_ROLES = ["REGISTRY"]
VIEWER_ROLES = ["REGISTRY", "PUBLIC", "COMPANY"]


@router.get("/overview", response_model=RequesterOverview)
def requester_overview(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REQUESTER_ROLES)),
):
    return service.requester_overview(db, current_user)


@router.get("/preview/{property_id}")
def preview_property(
    property_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REQUESTER_ROLES)),
):
    """Property information that will be submitted with a new request."""
    return service.preview_snapshot(db, current_user, property_id)


@router.post("/", response_model=RiskRequestDetail, status_code=201)
def submit_request(
    payload: RiskRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REQUESTER_ROLES)),
):
    return service.create_request(
        db,
        current_user,
        payload.property_id,
        payload.notes,
        payload.include_evidence,
    )


@router.get("/queue", response_model=RegistryQueue)
def registry_queue(
    status: RequestStatus | None = None,
    requester_type: str | None = Query(None, pattern="^(PUBLIC|COMPANY)$"),
    submitted_from: date | None = None,
    submitted_to: date | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.registry_queue(
        db,
        current_user,
        status_filter=status,
        requester_type=requester_type,
        submitted_from=submitted_from,
        submitted_to=submitted_to,
        skip=skip,
        limit=limit,
    )


@router.get("/{request_id}", response_model=RiskRequestDetail)
def get_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEWER_ROLES)),
):
    return service.get_request_detail(db, current_user, request_id)


@router.get("/{request_id}/certificate")
def download_certificate(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(VIEWER_ROLES)),
):
    filename, body = service.certificate_html(db, current_user, request_id)
    return Response(
        content=body,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{request_id}/workspace", response_model=RegistryWorkspace)
def registry_workspace(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.registry_workspace(db, current_user, request_id)


@router.post("/{request_id}/start-review", response_model=RegistryWorkspace)
def start_review(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.start_review(db, current_user, request_id)


@router.patch("/{request_id}/draft", response_model=RiskRequestDetail)
def save_draft(
    request_id: str,
    payload: RiskDraftUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.save_draft(
        db,
        current_user,
        request_id,
        checks=payload.verification_checks.model_dump(exclude_unset=True)
        if payload.verification_checks
        else None,
        risk_score=payload.risk_score,
        registry_notes=payload.registry_notes,
    )


@router.post("/{request_id}/verify", response_model=RiskRequestDetail)
def verify_and_send(
    request_id: str,
    payload: RiskVerifyRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.verify_and_send(
        db,
        current_user,
        request_id,
        checks=payload.verification_checks.model_dump(),
        risk_score=payload.risk_score,
        registry_notes=payload.registry_notes,
    )


@router.post("/{request_id}/reject", response_model=RiskRequestDetail)
def reject_request(
    request_id: str,
    payload: RiskRejectRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(REGISTRY_ROLES)),
):
    return service.reject(db, current_user, request_id, payload.reason)
