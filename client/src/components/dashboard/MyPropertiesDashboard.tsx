"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SharePropertyModal } from "@/components/property-search/SharePropertyModal";
import { api } from "@/lib/api/client";
import {
  propertyHref,
  shortenId,
  statusVariant
} from "@/lib/property-search/types";
import type {
  PaginatedUserRelatedProperties,
  UserRelatedProperty
} from "@/lib/users/types";

export function MyPropertiesDashboard() {
  const [items, setItems] = useState<UserRelatedProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "owned" | "shared">(
    "all"
  );
  const [shareTarget, setShareTarget] = useState<{
    propertyId: string;
    propertyName: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<PaginatedUserRelatedProperties>(
          "/api/v1/properties/mine",
          { params: { skip: 0, limit: 100 } }
        );
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError(
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Unable to load your related properties."
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
  }, []);

  const filteredItems = items.filter((item) => {
    if (filterType === "owned") return item.is_current_owner;
    if (filterType === "shared") return !item.is_current_owner;
    return true;
  });
  const ownedCount = items.filter((item) => item.is_current_owner).length;
  const sharedCount = items.filter((item) => !item.is_current_owner).length;

  return (
    <div className="space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
          My Properties
        </h2>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/shared-properties"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
        >
          <Icons.FolderOpen className="h-[18px] w-[18px] text-primary" />
          Shared Properties Inbox / Outbox
        </Link>
        <Link
          href="/property-search"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
        >
          <Icons.Search className="h-[18px] w-[18px]" />
          Browse own &amp; shared
        </Link>
        <Link
          href="/risk-analysis"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
        >
          <Icons.GppMaybe className="h-[18px] w-[18px]" />
          Request risk assessment
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Icons.LocationCity className="h-[22px] w-[22px] text-text-muted" />
            <h3 className="text-lg font-bold text-text-primary">
              Property Records
            </h3>
            {!loading && (
              <span className="text-xs text-text-muted">
                ({filteredItems.length} listed)
              </span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-subtle p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                filterType === "all"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              All ({total})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("owned")}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                filterType === "owned"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Your Owned ({ownedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("shared")}
              className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                filterType === "shared"
                  ? "bg-surface text-text-primary shadow-xs"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Shared / Due Diligence ({sharedCount})
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Loading properties…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : filteredItems.length === 0 ? (
          <div className="space-y-3 p-4 text-center">
            <p className="text-sm text-text-muted">
              {filterType === "owned"
                ? "You have no properties recorded under your primary ownership."
                : filterType === "shared"
                  ? "No properties have been shared with your account yet."
                  : "No properties are linked to your account yet as owner or shared transaction party."}
            </p>
            {filterType === "shared" && (
              <Link
                href="/shared-properties"
                className="inline-flex text-xs font-semibold text-primary hover:underline"
              >
                Go to Shared Properties Inbox →
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {filteredItems.map((property) => (
              <PropertyRow
                key={property.property_id}
                property={property}
                onShare={(p) => {
                  const title =
                    p.property_name?.trim() ||
                    p.title_deed_number?.trim() ||
                    p.property_id;
                  setShareTarget({
                    propertyId: p.property_id,
                    propertyName: title
                  });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {shareTarget && (
        <SharePropertyModal
          propertyId={shareTarget.propertyId}
          propertyName={shareTarget.propertyName}
          open={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}

function PropertyRow({
  property,
  onShare
}: {
  property: UserRelatedProperty;
  onShare: (property: UserRelatedProperty) => void;
}) {
  const title =
    property.property_name?.trim() ||
    property.title_deed_number?.trim() ||
    shortenId(property.property_id, 8, 6);
  const location = [property.address, property.district, property.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const verificationTone = statusVariant(property.verification_status);
  const encumbrances = property.encumbrances?.trim();

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div>
          <Link
            href={propertyHref(property.property_id)}
            className="font-medium text-link hover:text-link-hover"
          >
            {title}
          </Link>
          <p className="mt-0.5 font-mono text-xs text-text-muted">
            {property.property_id}
          </p>
          {location ? (
            <p className="mt-1 text-xs text-text-secondary">{location}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {property.is_current_owner ? (
            <StatusBadge
              label="Your Owned Property"
              variant="success"
              size="sm"
            />
          ) : (
            <StatusBadge label="Shared / Associated" variant="info" size="sm" />
          )}
          {property.in_ownership_history ? (
            <StatusBadge
              label="Ownership history"
              variant="neutral"
              size="sm"
            />
          ) : null}
          {property.in_transactions ? (
            <StatusBadge
              label="Transaction party"
              variant="neutral"
              size="sm"
            />
          ) : null}
          {property.party_roles.map((role) => (
            <StatusBadge key={role} label={role} variant="warning" size="sm" />
          ))}
          <StatusBadge
            label={
              (property.verification_status ?? "Unknown").trim() || "Unknown"
            }
            variant={verificationTone === "success" ? "info" : verificationTone}
            size="sm"
          />
        </div>
        {encumbrances ? (
          <p className="text-xs text-text-secondary">
            <span className="font-medium text-text-primary">Encumbrances:</span>{" "}
            {encumbrances}
          </p>
        ) : (
          <p className="text-xs text-text-muted">No encumbrances recorded.</p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {property.is_current_owner && (
          <button
            type="button"
            onClick={() => onShare(property)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
          >
            <Icons.Send className="h-4 w-4 text-primary" />
            Share with Buyer
          </button>
        )}
        <Link
          href={propertyHref(property.property_id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
        >
          View details
        </Link>
        <Link
          href={`/risk-analysis?property_id=${encodeURIComponent(property.property_id)}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
        >
          Request risk report
        </Link>
      </div>
    </li>
  );
}
