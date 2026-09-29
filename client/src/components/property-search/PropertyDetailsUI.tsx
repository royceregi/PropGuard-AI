"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyableHashBox } from "@/components/ui/CopyableHashBox";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatMoney,
  propertyHref,
  shortenId,
  statusVariant,
  userProfileHref,
  type PropertyDetail
} from "@/lib/property-search/types";

export function PropertyDetailsUI({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const canRequestRisk =
    user?.access_level === "PUBLIC" || user?.access_level === "COMPANY";
  const canVerify = Boolean(user);
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await api.get<PropertyDetail>(
          `/api/v1/properties/${encodeURIComponent(propertyId)}/full`
        );
        if (cancelled) {
          return;
        }
        setProperty(data);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setProperty(null);
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? "Property not found."
            : isAxiosError(err) &&
                typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to load property details."
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
  }, [propertyId]);

  if (loading) {
    return <p className="text-sm text-text-muted">Loading property details…</p>;
  }

  if (error || !property) {
    return (
      <div className="space-y-4">
        <Link
          href="/property-search"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-4 w-4" />
          Back to property search
        </Link>
        <p role="alert" className="text-sm text-danger">
          {error ?? "Property not found."}
        </p>
      </div>
    );
  }

  const displayId = shortenId(property.property_id, 10, 6);
  const title =
    property.property_name?.trim() ||
    property.title_deed_number?.trim() ||
    displayId;
  const verificationLabel =
    (property.verification_status ?? "Unknown").trim() || "Unknown";
  const verificationTone = statusVariant(property.verification_status);
  const legalLabel = (property.legal_status ?? "Unknown").trim() || "Unknown";
  const legalTone = statusVariant(property.legal_status);
  const location = [property.address, property.district, property.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const ownership = [...(property.ownership_history ?? [])].sort((a, b) => {
    const aDate = a.ownership_start_date ?? a.recorded_at ?? "";
    const bDate = b.ownership_start_date ?? b.recorded_at ?? "";
    return bDate.localeCompare(aDate);
  });
  const transactions = [...(property.transactions ?? [])].sort((a, b) => {
    const aDate = a.transaction_datetime ?? "";
    const bDate = b.transaction_datetime ?? "";
    return bDate.localeCompare(aDate);
  });
  const documents = property.documents ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Property Search", href: "/property-search" },
            { label: displayId }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              {title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={verificationLabel}
                variant={
                  verificationTone === "success" ? "info" : verificationTone
                }
                icon={
                  verificationTone === "success" ? (
                    <Icons.Verified />
                  ) : (
                    <Icons.HourglassEmpty />
                  )
                }
                size="md"
              />
              <StatusBadge
                label={legalLabel}
                variant={legalTone}
                icon={<Icons.Gavel />}
                size="md"
              />
              <StatusBadge
                label="Risk N/A"
                variant="neutral"
                icon={<Icons.GppMaybe />}
                size="md"
              />
            </div>
            <p className="mt-2 font-mono text-xs break-all text-text-muted">
              {property.property_id}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-0">
            {canVerify ? (
              <Link
                href={`/blockchain-verification?property_id=${encodeURIComponent(property.property_id)}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-text-primary transition-colors hover:bg-surface-subtle"
              >
                <Icons.ViewInAr className="h-[18px] w-[18px]" />
                Verify Blockchain
              </Link>
            ) : null}
            {canRequestRisk ? (
              <Link
                href={`/risk-analysis?property_id=${encodeURIComponent(property.property_id)}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-text-inverse transition-colors hover:bg-primary-hover"
              >
                <Icons.GppMaybe className="h-[18px] w-[18px]" />
                Request Risk Assessment
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="AI investigation coming later"
                className="flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-primary px-4 font-medium text-white opacity-60"
              >
                <Icons.AutoAwesome className="h-[18px] w-[18px]" />
                Run AI Investigation
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.LocationCity className="h-[22px] w-[22px] text-text-muted" />
              Property Details
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Detail label="Property ID" value={property.property_id} mono />
              <Detail
                label="Title Deed"
                value={property.title_deed_number}
                mono
              />
              <Detail label="Land Type" value={property.land_type} />
              <Detail
                label="Usage"
                value={property.current_usage_type || property.current_subtype}
              />
              <Detail
                label="Total Area"
                value={formatArea(property.land_area, property.area_unit)}
              />
              <Detail
                label="Current Value"
                value={
                  formatMoney(property.current_value) === "—"
                    ? "—"
                    : `${formatMoney(property.current_value)} AED`
                }
              />
              <Detail label="Location" value={location || "—"} />
              <Detail
                label="Survey Plan"
                value={property.survey_plan_number}
                mono
              />
              <Detail
                label="Current Owner"
                value={
                  property.current_owner?.full_name?.trim() ||
                  property.current_owner_id
                }
                href={userProfileHref(
                  property.current_owner,
                  property.current_owner_id
                )}
              />
              <Detail
                label="Current Owner ID"
                value={property.current_owner_id}
                mono
              />
              <Detail label="Encumbrances" value={property.encumbrances} />
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.History className="h-[22px] w-[22px] text-text-muted" />
              Ownership History
            </h2>
            {ownership.length === 0 ? (
              <p className="text-sm text-text-muted">
                No ownership history recorded for this property.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                    <tr>
                      <th className="pb-3 pr-4">Owner</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Start</th>
                      <th className="pb-3 pr-4">End</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownership.map((row) => {
                      const ownerHref = userProfileHref(
                        row.owner,
                        row.owner_id
                      );
                      return (
                        <tr
                          key={row.ownership_id}
                          className="border-t border-border-subtle"
                        >
                          <td className="py-3 pr-4 text-text-primary">
                            {ownerHref ? (
                              <Link
                                href={ownerHref}
                                className="font-medium text-link hover:text-link-hover"
                              >
                                {row.owner?.full_name?.trim() ||
                                  row.owner_id?.trim() ||
                                  "—"}
                              </Link>
                            ) : (
                              row.owner?.full_name?.trim() ||
                              row.owner_id?.trim() ||
                              "—"
                            )}
                            {row.owner_id ? (
                              <div className="mt-0.5 font-mono text-xs text-text-muted">
                                {row.owner_id}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">
                            {row.ownership_type?.trim() || "—"}
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">
                            {formatDate(row.ownership_start_date)}
                          </td>
                          <td className="py-3 pr-4 text-text-secondary">
                            {formatDate(row.ownership_end_date)}
                          </td>
                          <td className="py-3">
                            <StatusBadge
                              label={(
                                row.ownership_status ?? "—"
                              ).toUpperCase()}
                              variant={statusVariant(row.ownership_status)}
                              size="sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Receipt className="h-[22px] w-[22px] text-text-muted" />
              Related Transactions
            </h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-text-muted">
                No transactions linked to this property.
              </p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {transactions.slice(0, 8).map((tx) => (
                  <li
                    key={tx.transaction_id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/transactions/${encodeURIComponent(tx.transaction_id)}`}
                        className="font-mono text-sm text-link hover:text-link-hover"
                      >
                        {shortenId(tx.transaction_id, 8, 6)}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {tx.registration_type ||
                          tx.transaction_group ||
                          tx.procedure_name ||
                          "Transaction"}{" "}
                        · {formatDateTime(tx.transaction_datetime)}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Seller:{" "}
                        {tx.seller?.user?.full_name?.trim() ||
                          tx.seller?.party_name?.trim() ||
                          "—"}
                        {" · "}
                        Buyer:{" "}
                        {tx.buyer?.user?.full_name?.trim() ||
                          tx.buyer?.party_name?.trim() ||
                          "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-text-primary tabular-nums">
                        {formatMoney(tx.transaction_value) === "—"
                          ? "—"
                          : `${formatMoney(tx.transaction_value)} ${tx.currency?.trim() || "AED"}`}
                      </span>
                      <StatusBadge
                        label={(tx.status ?? "—").toUpperCase()}
                        variant={statusVariant(tx.status)}
                        size="sm"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Balance className="h-[22px] w-[22px] text-text-muted" />
              Boundaries
            </h2>
            <div className="grid grid-cols-1 gap-4">
              <Detail label="North" value={property.boundary_north} />
              <Detail label="South" value={property.boundary_south} />
              <Detail label="East" value={property.boundary_east} />
              <Detail label="West" value={property.boundary_west} />
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.ViewInAr className="h-[22px] w-[22px] text-text-muted" />
              Registry Snapshot
            </h2>
            <div className="mb-4 flex flex-col gap-4">
              <CopyableHashBox
                label="Property ID"
                value={property.property_id}
                displayValue={shortenId(property.property_id, 8, 6)}
              />
              <Detail
                label="Record path"
                value={propertyHref(property.property_id)}
                mono
              />
              <Detail
                label="Last updated"
                value={formatDateTime(property.updated_at)}
              />
            </div>
            <div className="mt-auto border-t border-border-subtle pt-4">
              <div className="flex items-center gap-2">
                <Icons.HourglassEmpty className="h-[18px] w-[18px] text-text-muted" />
                <span className="text-xs font-medium text-text-muted">
                  On-chain verification coming later
                </span>
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Description className="h-[22px] w-[22px] text-text-muted" />
              Documents
            </h2>
            {documents.length === 0 ? (
              <p className="text-sm text-text-muted">
                No documents on file for this property.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <li
                    key={doc.document_id}
                    className="rounded-lg border border-border-subtle bg-surface-subtle/40 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {doc.document_type?.trim() ||
                          doc.document_number?.trim() ||
                          `Document #${doc.document_id}`}
                      </span>
                      <StatusBadge
                        label={(doc.verification_status ?? "—").toUpperCase()}
                        variant={statusVariant(doc.verification_status)}
                        size="sm"
                      />
                    </div>
                    {doc.document_hash ? (
                      <CopyableHashBox
                        label="Document hash"
                        value={doc.document_hash}
                        displayValue={shortenId(doc.document_hash, 8, 6)}
                      />
                    ) : (
                      <p className="text-xs text-text-muted">
                        No hash on record
                      </p>
                    )}
                    <p className="mt-2 text-xs text-text-muted">
                      Issued {formatDate(doc.issued_date)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
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
