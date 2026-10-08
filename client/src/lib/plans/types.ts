export type SubscriptionPlanId = "MONTHLY" | "SIX_MONTH" | "YEARLY";

export type PaymentStatus = "PENDING" | "PAID";

export type SubscriptionStatus = "NONE" | "ACTIVE" | "EXPIRED";

export interface CommercialPlan {
  id: SubscriptionPlanId;
  name: string;
  duration_label: string;
  duration_months: number;
  duration_days: number;
  price: number;
  currency: string;
  formatted_price: string;
  billing_cycle: string;
  description: string;
  features: string[];
  is_popular?: boolean;
  badge?: string | null;
}

export interface PlanListResponse {
  plans: CommercialPlan[];
}

export interface ConfirmPaymentPayload {
  plan: SubscriptionPlanId;
  terms_accepted: boolean;
}

export interface SubscriptionStatusResponse {
  payment_status: PaymentStatus | string;
  subscription_status: SubscriptionStatus | string;
  subscription_plan: SubscriptionPlanId | string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  is_active_subscription: boolean;
  plan_details?: CommercialPlan | null;
}

export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    id: "MONTHLY",
    name: "1 Month Plan",
    duration_label: "1 Month",
    duration_months: 1,
    duration_days: 30,
    price: 5000,
    currency: "LKR",
    formatted_price: "LKR 5,000",
    billing_cycle: "Billed monthly",
    description:
      "Essential 1-month full access to property records, land registry cross-check, and blockchain ledger integrity.",
    features: [
      "Full blockchain property verification",
      "Land registry cross-check",
      "Official ownership chain tracking",
      "Standard forensic inquiry access",
      "Interactive property map view"
    ],
    is_popular: false,
    badge: null
  },
  {
    id: "SIX_MONTH",
    name: "6 Month Plan",
    duration_label: "6 Months",
    duration_months: 6,
    duration_days: 182,
    price: 25000,
    currency: "LKR",
    formatted_price: "LKR 25,000",
    billing_cycle: "Billed every 6 months · Save ~16%",
    description:
      "Comprehensive 6-month access for active property buyers, real estate investors, and continuous title verification.",
    features: [
      "All 1 Month features included",
      "Forensic transaction timeline view",
      "Priority risk assessment request queue",
      "Automated ledger tamper alerts",
      "Email & dashboard notifications",
      "Priority customer assistance"
    ],
    is_popular: true,
    badge: "Most Popular"
  },
  {
    id: "YEARLY",
    name: "1 Year Plan",
    duration_label: "1 Year",
    duration_months: 12,
    duration_days: 365,
    price: 45000,
    currency: "LKR",
    formatted_price: "LKR 45,000",
    billing_cycle: "Billed annually · Save ~25%",
    description:
      "Best value continuous property integrity tracking, long-term title safety monitoring, and forensic reports.",
    features: [
      "All 6 Months features included",
      "Continuous multi-deed integrity monitoring",
      "Exportable forensic verification certificates",
      "Priority risk assessment processing",
      "Dedicated account manager support",
      "Unlimited forensic audit searches"
    ],
    is_popular: false,
    badge: "Best Value"
  }
];

export function getCommercialPlan(
  planId: string | null | undefined
): CommercialPlan | undefined {
  if (!planId) {
    return undefined;
  }
  const key = planId.trim().toUpperCase();
  return COMMERCIAL_PLANS.find((plan) => plan.id === key);
}
