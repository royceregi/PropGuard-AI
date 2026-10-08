"use client";

import { useEffect } from "react";
import { Icons } from "@/components/icons";

interface TermsConditionsModalProps {
  open: boolean;
  onClose: () => void;
}

export function TermsConditionsModal({
  open,
  onClose
}: TermsConditionsModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <Icons.Shield className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="terms-modal-title"
                className="text-lg font-bold text-text-primary sm:text-xl"
              >
                Commercial Subscription Terms
              </h2>
              <p className="text-xs text-text-muted">
                PropGuard AI Property Integrity & Verification Platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            <Icons.Close className="!h-5 !w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 overflow-y-auto p-5 text-sm text-text-secondary sm:p-6">
          <section className="space-y-1.5">
            <h3 className="font-semibold text-text-primary">
              1. Commercial Plan & Platform Access
            </h3>
            <p className="leading-relaxed">
              By subscribing to a PropGuard AI Commercial Plan, public customers
              gain authorized access to cryptographic title deed verifications,
              land registry synchronization features, tamper detection alerts,
              and official risk assessment reports for properties they own or
              are parties to.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-text-primary">
              2. Subscription Duration & Billing Simulation
            </h3>
            <p className="leading-relaxed">
              The selected subscription term (1 Month, 6 Months, or 1 Year)
              commences immediately upon payment confirmation. This version of
              PropGuard operates with simulated billing confirmation for testing
              and onboarding purposes. All features and time-based access
              controls function in accordance with the chosen duration.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-text-primary">
              3. Data Integrity & Blockchain Records
            </h3>
            <p className="leading-relaxed">
              All transactions and verified snapshots are cross-referenced with
              the immutable ledger. Commercial subscribers may not alter
              official land registry records or historical signatures. Reports
              generated are forensic evidentiary documents subject to official
              registry validation.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-text-primary">
              4. Expiration & Account Renewal
            </h3>
            <p className="leading-relaxed">
              When your subscription period reaches its expiration date,
              property monitoring and active inquiry features will pause until a
              renewal plan is selected. Your account identity, historical
              verification records, and profile remain securely preserved.
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold text-text-primary">
              5. Privacy & Fair Usage
            </h3>
            <p className="leading-relaxed">
              Access is provided exclusively for genuine title verification and
              property security. Automated scraping, unauthorized redistribution
              of confidential registry digests, or misuse of cryptographic
              hashes is strictly prohibited.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border-subtle p-4 sm:p-5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
