"""Phase 7 — Analytics API Endpoint (10-frontend-screens.md §2).

GET /api/v1/analytics/dashboard — DB-backed dashboard metrics and charts data.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.roles import normalize_access_level
from app.models.user import User as UserModel
from app.services import analytics_service

router = APIRouter()

# Registry-wide figures; PUBLIC users get their own My Properties dashboard instead.
STAFF_ROLES = ["SYSTEM", "REGISTRY", "COMPANY"]
# Recent query text can contain other users' questions.
QUERY_LOG_ROLES = {"SYSTEM", "REGISTRY"}


@router.get("/dashboard")
def dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles(STAFF_ROLES)),
) -> dict[str, Any]:
    """Database-backed analytics summary, charts, and activity data."""
    return analytics_service.get_dashboard_analytics(
        db,
        include_recent_queries=normalize_access_level(current_user.access_level) in QUERY_LOG_ROLES,
    )
