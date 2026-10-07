"""Phase 7 — Analytics API Endpoint (10-frontend-screens.md §2).

GET /api/v1/analytics/dashboard — DB-backed dashboard metrics and charts data.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.user import User as UserModel
from app.services import analytics_service

router = APIRouter()

# Dashboard analytics available to SYSTEM, REGISTRY, COMPANY, and PUBLIC (scoped metrics)
ALL_ROLES = ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]


@router.get("/dashboard")
def dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(ALL_ROLES)),
) -> dict[str, Any]:
    """Database-backed analytics summary, charts, and activity data."""
    return analytics_service.get_dashboard_analytics(db)
