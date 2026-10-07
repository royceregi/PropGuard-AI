"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { PaymentConfirmationModal } from "@/components/commercial-plans/PaymentConfirmationModal";
import { TermsConditionsModal } from "@/components/commercial-plans/TermsConditionsModal";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import {
  COMMERCIAL_PLANS,
  type CommercialPlan,
  type PlanListResponse,
  type SubscriptionStatusResponse
} from "@/lib/plans/types";
import { toast } from "@/lib/toast";

export function CommercialPlansUI() {
  const router = useRouter();
  const { user } = useAuth();
  const setSession = useAuthStore((state) => state.setSession);
  const token = useAuthStore((state) => state.token);

  const [plans, setPlans] = useState<CommercialPlan[]>(COMMERCIAL_PLANS);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CommercialPlan | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch dynamic plans if available from backend
  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      try {
        setLoading(true);
        const { data } = await api.get<PlanListResponse>(
          "/api/v1/subscription/plans"
        );
        if (!cancelled && data.plans && data.plans.length > 0) {
          setPlans(data.plans);
        }
      } catch {
        // Fall back to preconfigured plans
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSelectPlan(plan: CommercialPlan) {
    setSelectedPlan(plan);
    setConfirmModalOpen(true);
  }

  async function handleConfirmPayment(plan: CommercialPlan) {
    setSubmitting(true);
    try {
      const { data } = await api.post<SubscriptionStatusResponse>(
        "/api/v1/subscription/confirm",
        {
          plan: plan.id,
          terms_accepted: true
        }
      );

      // Update active user state in store
      if (user) {
        const updatedUser = {
          ...user,
          payment_status: data.payment_status || "PAID",
          subscription_status: data.subscription_status || "ACTIVE",
          subscription_plan: data.subscription_plan || plan.id,
          subscription_start_date: data.subscription_start_date,
          subscription_end_date: data.subscription_end_date
        };
        setSession(updatedUser, token);
      }

      setConfirmModalOpen(false);
      toast.success(
        "Payment confirmed successfully. Your subscription is now active."
      );

      // Navigate to customer dashboard
      router.replace("/dashboard/my-properties");
      router.refresh();
    } catch (err) {
      toast.error("Unable to process payment confirmation", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <header className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">
          <Icons.Shield className="h-3.5 w-3.5" />
          <span>PropGuard AI · Commercial Subscriptions</span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl lg:text-4xl">
          Choose Your Plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary sm:text-base">
          Select a plan to activate your account and continue using the
          platform. Gain full access to verified blockchain records, title deed
          integrity, and land registry history.
        </p>
      </header>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPopular = Boolean(plan.is_popular);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl border bg-surface p-6 shadow-sm transition-all hover:shadow-md ${
                isPopular
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              }`}
            >
              {/* Popular Badge */}
              {isPopular ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-text-inverse shadow-sm">
                  {plan.badge || "Most Popular"}
                </div>
              ) : plan.badge ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-surface-muted px-3 py-0.5 text-xs font-semibold text-text-secondary shadow-sm">
                  {plan.badge}
                </div>
              ) : null}

              {/* Card Top */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-text-primary">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {plan.duration_label} Access
                  </p>
                </div>

                <div className="border-y border-border-subtle py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-text-primary sm:text-3xl">
                      {plan.formatted_price}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {plan.billing_cycle}
                  </p>
                </div>

                <p className="text-xs leading-relaxed text-text-secondary">
                  {plan.description}
                </p>

                {/* Features List */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-xs font-semibold tracking-wider text-text-primary uppercase">
                    What&apos;s included:
                  </span>
                  <ul className="space-y-2 text-xs text-text-secondary">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Icons.CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Bottom CTA */}
              <div className="mt-6 space-y-3 pt-4">
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan)}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-primary text-text-inverse hover:bg-primary-hover shadow-sm"
                      : "border border-border bg-surface hover:bg-surface-subtle text-text-primary"
                  }`}
                >
                  <Icons.Payment className="h-4 w-4" />
                  <span>Pay Now</span>
                </button>

                <p className="text-center text-[11px] text-text-muted">
                  Includes access subject to{" "}
                  <button
                    type="button"
                    onClick={() => setTermsModalOpen(true)}
                    className="font-medium text-link underline hover:text-link-hover"
                  >
                    Terms & Conditions
                  </button>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Assurance Banner */}
      <div className="rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-container text-success">
              <Icons.Shield className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text-primary">
                Cryptographically Secured by PropGuard
              </h4>
              <p className="text-xs text-text-muted">
                Zero data tampering risk. All verification records are hashed
                and verified on the ledger.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTermsModalOpen(true)}
            className="self-start text-xs font-semibold text-link hover:text-link-hover sm:self-auto"
          >
            Review Subscription Policies →
          </button>
        </div>
      </div>

      {/* Modals */}
      <PaymentConfirmationModal
        plan={selectedPlan}
        open={confirmModalOpen}
        submitting={submitting}
        onClose={() => {
          if (!submitting) {
            setConfirmModalOpen(false);
          }
        }}
        onConfirm={handleConfirmPayment}
        onOpenTerms={() => setTermsModalOpen(true)}
      />

      <TermsConditionsModal
        open={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
      />
    </div>
  );
}

