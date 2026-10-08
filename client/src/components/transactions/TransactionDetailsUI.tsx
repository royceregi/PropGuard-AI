"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableHashBox } from "@/components/ui/CopyableHashBox";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import {
  formatDateTimeFull,
  formatMoneyWithCurrency,
  partyDisplayName,
  shortenId,
  statusVariant,
  type PropertyTransactionDetail,
  type TransactionParty
} from "@/lib/transactions/types";
import { userProfileHref } from "@/lib/users/types";
import {
  BlockchainRiskPanel,
  type BlockchainRiskPanelHandle
} from "./BlockchainRiskPanel";
import { LedgerIntegrityStatus } from "./LedgerIntegrityStatus";
import { RegistryChecksPanel } from "./RegistryChecksPanel";

export function TransactionDetailsUI({
  transactionId
}: {
  transactionId: string;
}) {
  const [transaction, setTransaction] =
    useState<PropertyTransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const canVerify = Boolean(user && user.access_level !== "PUBLIC");
  const riskPanelRef = useRef<BlockchainRiskPanelHandle>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get<PropertyTransactionDetail>(
          `/api/v1/property-transactions/${encodeURIComponent(transactionId)}`
        );
        if (cancelled) {
          return;
        }
        setTransaction(data);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setTransaction(null);
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? "Transaction not found."
            : isAxiosError(err) &&
                typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to load transaction details."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  if (loading) {
    return (
      <p className="text-sm text-text-muted">Loading transaction details…</p>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <Link
          href="/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-4 w-4" />
          Back to transactions
        </Link>
        <p role="alert" className="text-sm text-danger">
          {error ?? "Transaction not found."}
        </p>
      </div>
    );
  }

  const property = transaction.property;
  const statusLabel = (transaction.status ?? "Unknown").trim() || "Unknown";
  const statusTone = statusVariant(transaction.status);
  const displayId = shortenId(transaction.transaction_id, 10, 6);
  const areaLabel =
    property?.address?.trim() ||
    transaction.area_name?.trim() ||
    property?.district?.trim() ||
    "—";
  const projectLabel =
    transaction.project_name?.trim() ||
    transaction.master_project?.trim() ||
    "—";
  const landArea =
    property?.land_area != null
      ? `${property.land_area}${property.area_unit ? ` ${property.area_unit}` : ""}`
      : transaction.procedure_area != null
        ? `${transaction.procedure_area}`
        : "—";
  const parties = transaction.parties ?? [];
  const currentOwnerName =
    transaction.current_owner?.full_name?.trim() ||
    transaction.current_owner?.user_id ||
    property?.current_owner_id ||
    "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Transactions", href: "/transactions" },
            { label: displayId }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              Transaction {displayId}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={statusLabel}
                variant={statusTone === "success" ? "info" : statusTone}
                icon={
                  statusTone === "success" ? (
                    <Icons.AllInclusive />
                  ) : (
                    <Icons.HourglassEmpty />
                  )
                }
                size="md"
              />
              <StatusBadge
                label="Risk N/A"
                variant="neutral"
                icon={<Icons.GppMaybe />}
                size="md"
              />
              {transaction.seller_matches_current_owner === true ? (
                <StatusBadge
                  label="Seller = current owner"
                  variant="success"
                  size="md"
                />
              ) : transaction.seller_matches_current_owner === false ? (
                <StatusBadge
                  label="Seller ≠ current owner"
                  variant="warning"
                  size="md"
                />
              ) : null}
            </div>
            <p className="mt-2 font-mono text-xs break-all text-text-muted">
              {transaction.transaction_id}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-0">
            {canVerify ? (
              <Link
                href={`/blockchain-verification?${new URLSearchParams({
                  ...(transaction.property_id
                    ? { property_id: transaction.property_id }
                    : {}),
                  transaction_id: transaction.transaction_id
                }).toString()}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-text-primary transition-colors hover:bg-surface-subtle"
              >
                <Icons.ReceiptLong className="h-[18px] w-[18px]" />
                Verify Blockchain
              </Link>
            ) : null}
            <Link
              href={`/ai-investigation?transaction_id=${encodeURIComponent(transaction.transaction_id)}`}
              title="Open full 4-agent forensics pipeline console"
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-text-primary transition-colors hover:bg-surface-subtle"
            >
              <Icons.SmartToy className="h-[18px] w-[18px] text-primary" />
              AI Console
            </Link>
            <button
              type="button"
              onClick={() => riskPanelRef.current?.run()}
              title="Retrieval Agent verifies the ledger, Risk Agent scores it"
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Icons.AutoAwesome className="h-[18px] w-[18px]" />
              Run Quick Risk Check
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.LocationCity className="h-[22px] w-[22px] text-text-muted" />
              Property Information
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Detail
                label="Property ID"
                value={transaction.property_id}
                mono
                href={
                  transaction.property_id
                    ? `/property-search/${encodeURIComponent(transaction.property_id)}`
                    : undefined
                }
              />
              <Detail
                label="Property Type"
                value={
                  property?.land_type ||
                  transaction.registration_type ||
                  transaction.transaction_group
                }
              />
              <Detail
                label="Primary Usage"
                value={
                  property?.current_usage_type || property?.current_subtype
                }
              />
              <Detail label="Total Area" value={landArea} />
              <Detail label="Location" value={areaLabel} />
              <Detail label="Associated Project" value={projectLabel} />
              <Detail
                label="Current Owner"
                value={currentOwnerName}
                href={userProfileHref(transaction.current_owner)}
              />
              <Detail
                label="Current Owner ID"
                value={
                  transaction.current_owner?.user_id ||
                  property?.current_owner_id
                }
                mono
              />
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Receipt className="h-[22px] w-[22px] text-text-muted" />
              Transaction Details
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Detail
                label="Execution Date"
                value={formatDateTimeFull(transaction.transaction_datetime)}
                mono
              />
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Sale Price
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatMoneyWithCurrency(
                    transaction.transaction_value,
                    transaction.currency
                  )}
                </span>
              </div>
              <Detail
                label="Registration Type"
                value={transaction.registration_type}
              />
              <Detail label="Procedure" value={transaction.procedure_name} />
              <Detail
                label="Transaction Group"
                value={transaction.transaction_group}
              />
              <Detail
                label="Previous Value"
                value={formatMoneyWithCurrency(
                  transaction.previous_value,
                  transaction.currency
                )}
              />
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Group className="h-[22px] w-[22px] text-text-muted" />
              Participants
            </h2>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PartyCard label="Seller" party={transaction.seller} />
              <PartyCard
                label="Buyer / Acquiring Owner"
                party={transaction.buyer}
              />
            </div>
            {parties.length === 0 ? (
              <p className="text-sm text-text-muted">
                No transaction parties recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                    <tr>
                      <th className="pb-3 pr-4">Role</th>
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">User</th>
                      <th className="pb-3">Primary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map((party) => (
                      <tr
                        key={party.transaction_party_id}
                        className="border-t border-border-subtle"
                      >
                        <td className="py-3 pr-4 text-text-secondary">
                          {party.role?.trim() || "—"}
                        </td>
                        <td className="py-3 pr-4 text-text-primary">
                          {partyDisplayName(party)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-text-muted">
                          {party.user_id ? (
                            <Link
                              href={
                                userProfileHref(party.user, party.user_id) ??
                                "#"
                              }
                              className="text-link hover:text-link-hover"
                            >
                              {party.user_id}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 text-text-secondary">
                          {party.is_primary ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <BlockchainRiskPanel
            ref={riskPanelRef}
            transactionId={transaction.transaction_id}
          />

          <RegistryChecksPanel transactionId={transaction.transaction_id} />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.SmartToy className="h-[22px] w-[22px] text-primary" />
              AI Risk Assessment
            </h2>
            <p className="text-sm text-text-muted">
              Risk scoring is not wired yet. This panel will show the agent
              score and reasoning once the risk API is ready.
            </p>
            <div className="mt-4">
              <StatusBadge label="Risk N/A" variant="neutral" size="sm" />
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.ViewInAr className="h-[22px] w-[22px] text-text-muted" />
              Ledger Verification
            </h2>
            <div className="mb-6 flex flex-col gap-4">
              <CopyableHashBox
                label="Transaction ID"
                value={transaction.transaction_id}
                displayValue={shortenId(transaction.transaction_id, 8, 6)}
              />
              <Detail
                label="Property ID"
                value={transaction.property_id}
                mono
                href={
                  transaction.property_id
                    ? `/property-search/${encodeURIComponent(transaction.property_id)}`
                    : undefined
                }
              />
            </div>
            <div className="mt-auto border-t border-border-subtle pt-4">
              <LedgerIntegrityStatus
                transactionId={transaction.transaction_id}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PartyCard({
  label,
  party
}: {
  label: string;
  party: TransactionParty | null | undefined;
}) {
  const name = partyDisplayName(party);
  const href = userProfileHref(party?.user, party?.user_id);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle/50 p-4">
      <span className="mb-2 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
      </span>
      {href ? (
        <Link
          href={href}
          className="text-sm font-semibold text-link hover:text-link-hover"
        >
          {name}
        </Link>
      ) : (
        <p className="text-sm font-semibold text-text-primary">{name}</p>
      )}
      {party?.user_id ? (
        <p className="mt-1 font-mono text-xs text-text-muted">
          {party.user_id}
        </p>
      ) : null}
      {party?.role ? (
        <p className="mt-1 text-xs text-text-secondary">{party.role}</p>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  href
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  href?: string;
}) {
  const display = value?.toString().trim() ? value : "—";
  return (
    <div>
      <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
      </span>
      {href && display !== "—" ? (
        <Link
          href={href}
          className={`text-sm font-medium break-all text-link hover:text-link-hover ${
            mono ? "font-mono text-xs" : ""
          }`}
        >
          {display}
        </Link>
      ) : (
        <span
          className={`text-sm font-medium break-all text-text-primary ${
            mono ? "font-mono text-xs" : ""
          }`}
        >
          {display}
        </span>
      )}
    </div>
  );
}
