"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { api } from "@/lib/api/client";
import type { PropertyShareItem } from "@/lib/shares/types";

interface SharePropertyModalProps {
  propertyId: string;
  propertyName?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (share: PropertyShareItem) => void;
}

export function SharePropertyModal({
  propertyId,
  propertyName,
  open,
  onClose,
  onSuccess
}: SharePropertyModalProps) {
  const [buyerUserId, setBuyerUserId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successShare, setSuccessShare] = useState<PropertyShareItem | null>(
    null
  );

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetBuyer = buyerUserId.trim();
    if (!targetBuyer) {
      setError("Please specify the target buyer's User ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post<PropertyShareItem>(
        `/api/v1/properties/${encodeURIComponent(propertyId)}/shares`,
        {
          buyer_user_id: targetBuyer,
          expires_in_days: expiresInDays,
          notes: notes.trim() || null
        }
      );
      setSuccessShare(data);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : isAxiosError(err) && err.response?.status === 404
            ? "Target buyer user not found. Please verify the buyer's User ID."
            : isAxiosError(err) && err.response?.status === 403
              ? "Access denied. Only the registered property owner can create a share."
              : "Unable to share property. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleResetAndClose() {
    setBuyerUserId("");
    setNotes("");
    setError(null);
    setSuccessShare(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icons.Send className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Share Property with Buyer
              </h3>
              <p className="text-xs text-text-muted truncate max-w-xs">
                {propertyName || propertyId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
          >
            <Icons.Close className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {successShare ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-4 text-success">
              <Icons.CheckCircle className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  Property shared successfully!
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  Read-only due diligence access granted for{" "}
                  {successShare.buyer?.name || successShare.buyer_user_id}.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-surface-subtle p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Share Reference:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {successShare.share_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Target Buyer:</span>
                <span className="font-semibold text-text-primary">
                  {successShare.buyer_user_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Access Expiry:</span>
                <span className="text-text-primary">{expiresInDays} days</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="mt-2 h-10 w-full rounded-lg bg-primary text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <div className="rounded-lg bg-surface-subtle p-3 text-xs text-text-secondary">
              <p>
                Sharing provides the prospective buyer with{" "}
                <strong>read-only access</strong> to official deeds, ownership
                chronology, and blockchain hash integrity checks.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-critical-container p-3 text-xs text-danger">
                <Icons.WarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Buyer User ID */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="buyer-user-id"
                className="text-xs font-bold text-text-secondary uppercase tracking-wider"
              >
                Target Buyer User ID *
              </label>
              <div className="relative">
                <Icons.ManageAccounts className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="buyer-user-id"
                  type="text"
                  required
                  value={buyerUserId}
                  onChange={(e) => {
                    setBuyerUserId(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. USR-0004 or USR-..."
                  className="h-10 w-full rounded-lg border border-border bg-background py-1.5 pr-3 pl-9 font-mono text-xs text-text-primary placeholder:font-sans placeholder:text-text-muted focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>

            {/* Expiry in Days */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="expires-days"
                className="text-xs font-bold text-text-secondary uppercase tracking-wider"
              >
                Access Expiration
              </label>
              <select
                id="expires-days"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-text-primary focus:border-primary focus:outline-hidden"
              >
                <option value={7}>7 Days (Short Due Diligence)</option>
                <option value={14}>14 Days (Standard Review)</option>
                <option value={30}>30 Days (Full Transaction Period)</option>
                <option value={60}>60 Days (Extended Closing)</option>
                <option value={90}>90 Days (Quarterly Closing)</option>
              </select>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="share-notes"
                className="text-xs font-bold text-text-secondary uppercase tracking-wider"
              >
                Message / Notes for Buyer (Optional)
              </label>
              <textarea
                id="share-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Please verify title deed #... and review blockchain verification status before signing contract."
                className="rounded-lg border border-border bg-background p-3 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-hidden"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-border pt-4">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="h-10 rounded-lg px-4 text-xs font-semibold text-text-secondary hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !buyerUserId.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Icons.Sync className="h-4 w-4 animate-spin" />
                    Sharing Property…
                  </>
                ) : (
                  <>
                    <Icons.Send className="h-4 w-4" />
                    Share Property
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
