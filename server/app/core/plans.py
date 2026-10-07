from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.models.user import User


class SubscriptionPlan(str, Enum):
    MONTHLY = "MONTHLY"
    SIX_MONTH = "SIX_MONTH"
    YEARLY = "YEARLY"


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    PAID = "PAID"


class SubscriptionStatus(str, Enum):
    NONE = "NONE"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"


COMMERCIAL_PLANS: dict[str, dict[str, Any]] = {
    SubscriptionPlan.MONTHLY.value: {
        "id": SubscriptionPlan.MONTHLY.value,
        "name": "1 Month Plan",
        "duration_label": "1 Month",
        "duration_months": 1,
        "duration_days": 30,
        "price": 5000,
        "currency": "LKR",
        "formatted_price": "LKR 5,000",
        "billing_cycle": "Billed monthly",
        "description": "Essential 1-month full access to property records, land registry cross-check, and blockchain ledger integrity.",
        "features": [
            "Full blockchain property verification",
            "Land registry cross-check",
            "Official ownership chain tracking",
            "Standard forensic inquiry access",
        ],
        "is_popular": False,
        "badge": None,
    },
    SubscriptionPlan.SIX_MONTH.value: {
        "id": SubscriptionPlan.SIX_MONTH.value,
        "name": "6 Month Plan",
        "duration_label": "6 Months",
        "duration_months": 6,
        "duration_days": 182,
        "price": 25000,
        "currency": "LKR",
        "formatted_price": "LKR 25,000",
        "billing_cycle": "Billed every 6 months (Save ~16%)",
        "description": "Comprehensive 6-month access for active property buyers, real estate investors, and continuous title verification.",
        "features": [
            "All 1 Month features included",
            "Forensic transaction timeline view",
            "Priority risk assessment request queue",
            "Automated ledger tamper alerts",
            "Email & dashboard notifications",
        ],
        "is_popular": True,
        "badge": "Most Popular",
    },
    SubscriptionPlan.YEARLY.value: {
        "id": SubscriptionPlan.YEARLY.value,
        "name": "1 Year Plan",
        "duration_label": "1 Year",
        "duration_months": 12,
        "duration_days": 365,
        "price": 45000,
        "currency": "LKR",
        "formatted_price": "LKR 45,000",
        "billing_cycle": "Billed annually (Save ~25%)",
        "description": "Best value continuous property integrity tracking, long-term title safety monitoring, and forensic reports.",
        "features": [
            "All 6 Months features included",
            "Continuous multi-deed integrity monitoring",
            "Exportable forensic verification certificates",
            "Priority risk assessment processing",
            "Dedicated account support",
        ],
        "is_popular": False,
        "badge": "Best Value",
    },
}


def get_plan_details(plan_id: str | SubscriptionPlan) -> dict[str, Any] | None:
    key = plan_id.value if isinstance(plan_id, SubscriptionPlan) else str(plan_id).strip().upper()
    return COMMERCIAL_PLANS.get(key)


def calculate_subscription_end_date(
    plan: str | SubscriptionPlan,
    start_date: datetime | None = None,
) -> datetime:
    start = start_date or datetime.now(timezone.utc).replace(tzinfo=None)
    key = plan.value if isinstance(plan, SubscriptionPlan) else str(plan).strip().upper()
    plan_info = COMMERCIAL_PLANS.get(key)
    days = plan_info["duration_days"] if plan_info else 30
    return start + timedelta(days=days)


def check_user_subscription_status(user: User) -> None:
    """
    Refreshes user's subscription status if expired.
    Public users without active subscription or past end date become EXPIRED.
    """
    access_level = (user.access_level or "").strip().upper()
    # Non-public operational accounts (System/Admin, Registry, Company) do not require commercial subscriptions
    if access_level != "PUBLIC":
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Check expiration date
    if user.payment_status == PaymentStatus.PAID.value and user.subscription_end_date:
        if user.subscription_end_date < now:
            user.subscription_status = SubscriptionStatus.EXPIRED.value
            user.payment_status = PaymentStatus.PENDING.value
    elif user.payment_status != PaymentStatus.PAID.value:
        if user.subscription_status == SubscriptionStatus.ACTIVE.value:
            user.subscription_status = SubscriptionStatus.NONE.value
