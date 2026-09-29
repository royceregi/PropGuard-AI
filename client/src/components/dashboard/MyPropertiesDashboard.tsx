"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
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

  return (
    <div className="space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
          My Properties
        </h2>
        <p className="max-w-2xl text-sm text-text-secondary">
          View details, ownership history, and encumbrances for properties you
          own or that were shared with you on a transaction. You can request a
          risk assessment and evidence report for those properties only;
          official records stay read-only.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-text-primary">
            <Icons.LocationCity className="h-[22px] w-[22px] text-text-muted" />
            Related properties
          </h3>
          {!loading ? (
            <span className="text-xs text-text-muted">{total} total</span>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Loading properties…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              No properties are linked to your account yet as owner, ownership
              history, or transaction party (shared).
            </p>
            <p className="text-sm text-text-secondary">
              When another party shares a property with you on a transaction, it
              will appear here. You cannot browse unrelated properties.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {items.map((property) => (
              <PropertyRow key={property.property_id} property={property} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PropertyRow({ property }: { property: UserRelatedProperty }) {
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
            <StatusBadge label="Current owner" variant="success" size="sm" />
          ) : null}
          {property.in_ownership_history ? (
            <StatusBadge label="Ownership history" variant="info" size="sm" />
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

      <div className="flex shrink-0 flex-wrap gap-2">
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
