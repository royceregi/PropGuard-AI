"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/toast";

interface RebuildResponse {
  cleared: number;
  total: number;
  success: number;
  failed: number;
  detail?: string;
}

export function BlockchainHashManagement() {
  const [busy, setBusy] = useState(false);

  async function rebuildHashes() {
    const confirmed = window.confirm(
      "Update all ledger hashes?\n\nThis clears and regenerates tx_hash, previous_hash, property_hash, and transaction_data_hash for every blockchain transaction, and re-signs each block with the registry key. Document hashes are never modified."
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    const toastId = toast.loading("Updating all hashes…", {
      description: "Clearing old values and regenerating the chain."
    });

    try {
      const { data } = await api.post<RebuildResponse>(
        "/api/v1/admin/blockchain/rebuild-hashes"
      );
      toast.success("All hashes updated", {
        id: toastId,
        description:
          `Cleared ${data.cleared.toLocaleString()}, updated ${data.success.toLocaleString()} of ${data.total.toLocaleString()}` +
          (data.failed ? ` (${data.failed} failed).` : "."),
        duration: 6000
      });
    } catch (err) {
      toast.error("Hash update failed", {
        id: toastId,
        description: errorMessage(err, "Unable to update ledger hashes."),
        duration: 7000
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="blockchain-hash-management-title"
      className="rounded-xl border border-border-subtle bg-surface p-5 shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
          <Icons.Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            id="blockchain-hash-management-title"
            className="text-base font-semibold text-text-primary"
          >
            Blockchain Hash Management
          </h2>
          <p className="text-sm text-text-secondary">
            Update ledger hashes for blockchain verification.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => void rebuildHashes()}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {busy ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              aria-hidden
            />
          ) : (
            <Icons.Sync className="h-4 w-4" />
          )}
          {busy ? "Updating all hashes…" : "Update All Hashes"}
        </button>
      </div>
    </section>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.detail === "string") {
    return err.response.data.detail;
  }
  return fallback;
}
