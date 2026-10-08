from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User as UserModel
from app.schemas.user_assistant import (
    UserAssistantHistoryItem,
    UserAssistantQueryRequest,
    UserAssistantQueryResponse,
)
from app.services import user_assistant_service

router = APIRouter()


@router.post("/query", response_model=UserAssistantQueryResponse)
def ask_assistant(
    payload: UserAssistantQueryRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Ask a natural language question scoped strictly to the current user's owned and shared properties.
    The response and question are automatically logged to the user's history in core.query_logs.
    """
    return user_assistant_service.process_user_query(db, current_user, payload.question)


@router.get("/history", response_model=list[UserAssistantHistoryItem])
def get_assistant_history(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Retrieve previous natural language questions and answers for the authenticated user.
    """
    return user_assistant_service.get_user_history(db, current_user.user_id, limit=limit)


@router.delete("/history")
def clear_assistant_history(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Clear the saved assistant question and answer history for the authenticated user.
    """
    deleted_count = user_assistant_service.clear_user_history(db, current_user.user_id)
    return {"status": "success", "deleted_count": deleted_count}
