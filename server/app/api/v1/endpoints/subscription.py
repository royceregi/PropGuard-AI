from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.plans import (
    COMMERCIAL_PLANS,
    PaymentStatus,
    SubscriptionPlan,
    SubscriptionStatus,
    check_user_subscription_status,
    get_plan_details,
)
from app.models.user import User
from app.repositories import user_repository
from app.schemas.plans import (
    CommercialPlanResponse,
    ConfirmPaymentRequest,
    PlanListResponse,
    SubscriptionStatusResponse,
)

router = APIRouter()


@router.get("/plans", response_model=PlanListResponse)
def list_commercial_plans() -> PlanListResponse:
    plans = [
        CommercialPlanResponse(
            id=plan["id"],
            name=plan["name"],
            duration_label=plan["duration_label"],
            duration_months=plan["duration_months"],
            duration_days=plan["duration_days"],
            price=plan["price"],
            currency=plan["currency"],
            formatted_price=plan["formatted_price"],
            billing_cycle=plan["billing_cycle"],
            description=plan["description"],
            features=plan["features"],
            is_popular=plan.get("is_popular", False),
            badge=plan.get("badge"),
        )
        for plan in COMMERCIAL_PLANS.values()
    ]
    return PlanListResponse(plans=plans)


@router.get("/status", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatusResponse:
    check_user_subscription_status(current_user)
    db.commit()
    db.refresh(current_user)

    is_public = (current_user.access_level or "").strip().upper() == "PUBLIC"
    is_active_sub = not is_public or (
        current_user.payment_status == PaymentStatus.PAID.value
        and current_user.subscription_status == SubscriptionStatus.ACTIVE.value
    )

    plan_info = None
    if current_user.subscription_plan:
        raw_plan = get_plan_details(current_user.subscription_plan)
        if raw_plan:
            plan_info = CommercialPlanResponse(**raw_plan)

    return SubscriptionStatusResponse(
        payment_status=current_user.payment_status or PaymentStatus.PENDING.value,
        subscription_status=current_user.subscription_status or SubscriptionStatus.NONE.value,
        subscription_plan=current_user.subscription_plan,
        subscription_start_date=current_user.subscription_start_date,
        subscription_end_date=current_user.subscription_end_date,
        is_active_subscription=is_active_sub,
        plan_details=plan_info,
    )


@router.post("/confirm", response_model=SubscriptionStatusResponse)
def confirm_subscription_payment(
    payload: ConfirmPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatusResponse:
    if not payload.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms & Conditions before confirming payment.",
        )

    plan_key = (
        payload.plan.value
        if isinstance(payload.plan, SubscriptionPlan)
        else str(payload.plan).upper()
    )
    if plan_key not in COMMERCIAL_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid commercial plan selected.",
        )

    updated_user = user_repository.confirm_subscription(
        db,
        user_id=current_user.user_id,
        plan=payload.plan,
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    raw_plan = get_plan_details(plan_key)
    plan_info = CommercialPlanResponse(**raw_plan) if raw_plan else None

    return SubscriptionStatusResponse(
        payment_status=updated_user.payment_status,
        subscription_status=updated_user.subscription_status,
        subscription_plan=updated_user.subscription_plan,
        subscription_start_date=updated_user.subscription_start_date,
        subscription_end_date=updated_user.subscription_end_date,
        is_active_subscription=True,
        plan_details=plan_info,
    )
