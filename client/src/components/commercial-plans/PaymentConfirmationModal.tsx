"use client";

import { useEffect, useId, useState } from "react";
import { Icons } from "@/components/icons";
import type { CommercialPlan } from "@/lib/plans/types";

interface PaymentConfirmationModalProps {
  plan: CommercialPlan | null;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (plan: CommercialPlan) => void;
  onOpenTerms: () => void;
}

export function PaymentConfirmationModal({
  plan,
  open,
  submitting,
  onClose,
  onConfirm,
  onOpenTerms
}: PaymentConfirmationModalProps) {
  const termsId = useId();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (open) {
      setAgreedToTerms(false);
    }
  }, [open, plan]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  if (!open || !plan) {
    return null;
  }

  const canConfirm = agreedToTerms && !submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!submitting) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Icons.Payment className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="payment-modal-title"
                className="text-lg font-bold text-text-primary sm:text-xl"
              >
                Payment Confirmation
              </h2>
              <p className="text-xs text-text-muted">
                Activate your commercial subscription
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
          >
            <Icons.Close className="!h-5 !w-5" />
          </button>
        </div>

        {/* Selected Plan Summary Card */}
        <div className="mt-5 space-y-4 rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
              You have selected:
            </span>
            <span className="inline-flex items-center rounded-md bg-primary-subtle px-2.5 py-0.5 text-xs font-semibold text-primary">
              {plan.duration_label} Access
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-base font-bold text-text-primary">
                {plan.name}
              </h3>
              <p className="text-xs text-text-secondary">
                {plan.billing_cycle}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-text-muted">Price:</span>
              <p className="text-xl font-extrabold text-primary sm:text-2xl">
                {plan.formatted_price}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle/80 bg-surface/70 px-3 py-2 text-xs text-text-secondary">
            <div className="flex items-center gap-1.5 font-medium text-text-primary">
              <Icons.CheckCircle className="h-3.5 w-3.5 text-success" />
              <span>Instant Simulated Activation</span>
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Access is enabled immediately without requiring third-party
              payment gateways.
            </p>
          </div>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="mt-5 space-y-3">
          <label
            htmlFor={termsId}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:bg-surface-subtle"
          >
            <input
              id={termsId}
              type="checkbox"
              checked={agreedToTerms}
              disabled={submitting}
              onChange={(event) => setAgreedToTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary accent-primary focus:ring-primary/20"
            />
            <span className="text-xs leading-relaxed text-text-secondary">
              I agree to the{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenTerms();
                }}
                className="font-semibold text-link underline transition-colors hover:text-link-hover"
              >
                Terms & Conditions
              </button>{" "}
              and authorize the activation of this subscription plan.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(plan)}
            aria-busy={submitting}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                <span>Processing Payment…</span>
              </>
            ) : (
              <>
                <Icons.Payment className="h-4 w-4" />
                <span>Confirm Payment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

