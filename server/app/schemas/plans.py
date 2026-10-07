from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.plans import SubscriptionPlan


class PlanFeature(BaseModel):
    title: str


class CommercialPlanResponse(BaseModel):
    id: str
    name: str
    duration_label: str
    duration_months: int
    duration_days: int
    price: int
    currency: str
    formatted_price: str
    billing_cycle: str
    description: str
    features: list[str]
    is_popular: bool = False
    badge: str | None = None


class PlanListResponse(BaseModel):
    plans: list[CommercialPlanResponse]


class ConfirmPaymentRequest(BaseModel):
    plan: SubscriptionPlan
    terms_accepted: bool = Field(
        ...,
        description="Customer must agree to Terms & Conditions before completing payment.",
    )


class SubscriptionStatusResponse(BaseModel):
    payment_status: str
    subscription_status: str
    subscription_plan: str | None = None
    subscription_start_date: datetime | None = None
    subscription_end_date: datetime | None = None
    is_active_subscription: bool
    plan_details: CommercialPlanResponse | None = None
