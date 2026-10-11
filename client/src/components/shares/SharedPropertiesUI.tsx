"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  LINK_REASON_LABELS,
  type LinkedPropertyItem,
  type PropertyShareItem
} from "@/lib/shares/types";
import { formatDateTime, shortenId } from "@/lib/property-search/types";

async function fetchShares() {
  const [receivedRes, sentRes, linkedRes] = await Promise.all([
    api.get<PropertyShareItem[]>("/api/v1/shares/received", {
      params: { active_only: false }
    }),
    api.get<PropertyShareItem[]>("/api/v1/shares/sent"),
    api.get<LinkedPropertyItem[]>("/api/v1/shares/linked")
  ]);
  return {
    received: receivedRes.data,
    sent: sentRes.data,
    linked: linkedRes.data
  };
}

function PropertyActions({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const canVerify = Boolean(user && user.access_level !== "PUBLIC");
  const id = encodeURIComponent(propertyId);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <Link
        href={`/property-search/${id}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
      >
        <Icons.Search className="h-3.5 w-3.5" />
        Inspect Details
      </Link>
      {canVerify ? (
        <Link
          href={`/blockchain-verification?property_id=${id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle transition-colors"
        >
          <Icons.ViewInAr className="h-3.5 w-3.5 text-text-muted" />
          Verify Ledger
        </Link>
      ) : null}
      <Link
        href={`/risk-analysis?property_id=${id}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle transition-colors"
      >
        <Icons.GppMaybe className="h-3.5 w-3.5 text-text-muted" />
        Risk Assessment
      </Link>
    </div>
  );
}

export function SharedPropertiesUI() {
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [receivedShares, setReceivedShares] = useState<PropertyShareItem[]>([]);
  const [sentShares, setSentShares] = useState<PropertyShareItem[]>([]);
  const [linkedProperties, setLinkedProperties] = useState<
    LinkedPropertyItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Revoke state
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const data = await fetchShares();
        if (!cancelled) {
          setReceivedShares(data.received);
          setSentShares(data.sent);
          setLinkedProperties(data.linked);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            isAxiosError(err) && typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to load property sharing records."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshData() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShares();
      setReceivedShares(data.received);
      setSentShares(data.sent);
      setLinkedProperties(data.linked);
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Unable to load property sharing records."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(propertyId: string, shareId: string) {
    if (
      !confirm(
        "Are you sure you want to revoke this buyer's access to this property?"
      )
    ) {
      return;
    }

    setRevokingShareId(shareId);
    setActionSuccess(null);
    setError(null);

    try {
      await api.delete(
        `/api/v1/properties/${encodeURIComponent(propertyId)}/shares/${encodeURIComponent(shareId)}`
      );
      setActionSuccess(`Share ${shareId} has been revoked successfully.`);
      await refreshData();
    } catch (err) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Unable to revoke property share."
      );
    } finally {
      setRevokingShareId(null);
    }
  }

  const sharedWithMeCount =
    new Set(
      receivedShares
        .filter((share) => share.is_active)
        .map((share) => share.property_id)
    ).size + linkedProperties.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      {/* Header & Breadcrumbs */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Shared Properties" }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icons.FolderOpen className="h-5 w-5" />
              </span>
              Shared Properties &amp; Buyer Due Diligence
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Secure, tamper-evident property access for prospective buyers and
              owners.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/my-properties"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary hover:bg-surface-subtle transition-colors"
            >
              <Icons.LocationCity className="h-4 w-4 text-text-muted" />
              My Registered Properties
            </Link>
          </div>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
          <Icons.CheckCircle className="h-4 w-4 shrink-0" />
          <p>{actionSuccess}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-critical-container p-3 text-xs text-danger">
          <Icons.WarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("received")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "received"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          <Icons.Mail className="h-4 w-4" />
          Shared With Me ({sharedWithMeCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sent")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "sent"
              ? "border-primary text-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          <Icons.Send className="h-4 w-4" />
          Sent Shares ({sentShares.length})
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center">
          <Icons.Sync className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-text-muted">
            Loading shared property records…
          </p>
        </div>
      ) : activeTab === "received" ? (
        /* Tab 1: Received Shares (Buyer Inbox) */
        <section className="flex flex-col gap-4">
          {receivedShares.length === 0 && linkedProperties.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <Icons.FolderOpen className="mx-auto h-8 w-8 text-text-muted" />
              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                No properties have been shared with you
              </h3>
              <p className="mt-1 text-xs text-text-secondary max-w-md mx-auto">
                When a registered property owner shares deed and blockchain
                verification access with your User ID, it will appear here.
              </p>
            </div>
          )}

          {receivedShares.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {receivedShares.map((share) => {
                const prop = share.property;
                const owner = share.owner;
                const isExpired =
                  share.expires_at && new Date(share.expires_at) < new Date();
                const isRevoked = Boolean(share.revoked_at);

                return (
                  <article
                    key={share.share_id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] text-text-muted">
                            Deed #{prop?.title_deed_number || share.property_id}
                          </span>
                          <h3 className="text-base font-bold text-text-primary mt-0.5">
                            {prop?.property_name ||
                              `Property ${shortenId(share.property_id, 10, 6)}`}
                          </h3>
                          <p className="text-xs text-text-secondary">
                            {[prop?.address, prop?.city, prop?.district]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </p>
                        </div>
                        <StatusBadge
                          label={
                            isRevoked
                              ? "Revoked"
                              : isExpired
                                ? "Expired"
                                : share.is_active
                                  ? "Active Access"
                                  : "Inactive"
                          }
                          variant={
                            isRevoked || isExpired
                              ? "error"
                              : share.is_active
                                ? "success"
                                : "neutral"
                          }
                          size="sm"
                        />
                      </div>

                      {/* Owner and Share Details */}
                      <div className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-text-muted">Shared by:</span>
                          <span className="font-semibold text-text-primary">
                            {owner?.name || share.owner_user_id}
                          </span>
                        </div>
                        {owner?.email && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">
                              Owner Contact:
                            </span>
                            <span className="text-text-secondary font-mono">
                              {owner.email}
                            </span>
                          </div>
                        )}
                        {share.expires_at && (
                          <div className="flex justify-between">
                            <span className="text-text-muted">
                              Access Expiry:
                            </span>
                            <span className="text-text-secondary">
                              {formatDateTime(share.expires_at)}
                            </span>
                          </div>
                        )}
                        {share.notes && (
                          <div className="pt-1 border-t border-border/50 text-text-secondary italic">
                            &ldquo;{share.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    <PropertyActions propertyId={share.property_id} />
                  </article>
                );
              })}
            </div>
          )}

          {linkedProperties.length > 0 && (
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">
                  Linked Through Your Records ({linkedProperties.length})
                </h2>
                <p className="text-xs text-text-secondary">
                  Properties you previously owned or took part in a transaction
                  for. You can view them read-only.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {linkedProperties.map((item) => {
                  const prop = item.property;
                  return (
                    <article
                      key={item.property_id}
                      className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] text-text-muted">
                            Deed #{prop?.title_deed_number || item.property_id}
                          </span>
                          <h3 className="text-base font-bold text-text-primary mt-0.5">
                            {prop?.property_name ||
                              `Property ${shortenId(item.property_id, 10, 6)}`}
                          </h3>
                          <p className="text-xs text-text-secondary">
                            {[prop?.address, prop?.city, prop?.district]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {item.reasons.map((reason) => (
                            <StatusBadge
                              key={reason}
                              label={LINK_REASON_LABELS[reason]}
                              variant="neutral"
                              size="sm"
                            />
                          ))}
                        </div>
                      </div>
                      <PropertyActions propertyId={item.property_id} />
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : (
        /* Tab 2: Sent Shares (Seller Outbox) */
        <section className="flex flex-col gap-4">
          {sentShares.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <Icons.Send className="mx-auto h-8 w-8 text-text-muted" />
              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                No active outgoing property shares
              </h3>
              <p className="mt-1 text-xs text-text-secondary max-w-md mx-auto">
                You have not shared any properties with buyers yet. Open any
                property on your dashboard and click &ldquo;Share with
                Buyer&rdquo; to generate access.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Prospective Buyer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Expires</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sentShares.map((share) => {
                    const isRevoked = Boolean(share.revoked_at);
                    const isExpired =
                      share.expires_at &&
                      new Date(share.expires_at) < new Date();
                    const canRevoke =
                      !isRevoked && !isExpired && share.is_active;

                    return (
                      <tr
                        key={share.share_id}
                        className="hover:bg-surface-subtle/40 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-text-primary">
                              {share.property?.property_name ||
                                share.property_id}
                            </span>
                            <span className="font-mono text-[10px] text-text-muted">
                              Deed #
                              {share.property?.title_deed_number ||
                                share.property_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-text-primary">
                              {share.buyer?.name || share.buyer_user_id}
                            </span>
                            <span className="font-mono text-[10px] text-text-muted">
                              {share.buyer?.email || share.buyer_user_id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={
                              isRevoked
                                ? "Revoked"
                                : isExpired
                                  ? "Expired"
                                  : share.is_active
                                    ? "Active"
                                    : "Inactive"
                            }
                            variant={
                              isRevoked || isExpired
                                ? "error"
                                : share.is_active
                                  ? "success"
                                  : "neutral"
                            }
                            size="sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                          {share.created_at
                            ? formatDateTime(share.created_at)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                          {share.expires_at
                            ? formatDateTime(share.expires_at)
                            : "No expiry"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canRevoke ? (
                            <button
                              type="button"
                              disabled={revokingShareId === share.share_id}
                              onClick={() =>
                                handleRevoke(share.property_id, share.share_id)
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-critical-container px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/20 disabled:opacity-50 transition-colors"
                            >
                              <Icons.Close className="h-3.5 w-3.5" />
                              Revoke
                            </button>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
