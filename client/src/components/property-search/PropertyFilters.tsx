"use client";

import { useId, useState, type FormEvent } from "react";
import { Icons } from "@/components/icons";
import {
  EMPTY_PROPERTY_SEARCH_FILTERS,
  type PropertySearchFilters
} from "@/lib/property-search/types";

const LAND_TYPE_OPTIONS = [
  { value: "", label: "All land types" },
  { value: "Residential", label: "Residential" },
  { value: "Commercial", label: "Commercial" },
  { value: "Industrial", label: "Industrial" },
  { value: "Mixed Use", label: "Mixed Use" }
];

const USAGE_OPTIONS = [
  { value: "", label: "Any usage" },
  { value: "Residential", label: "Residential" },
  { value: "Commercial", label: "Commercial" },
  { value: "Industrial", label: "Industrial" }
];

const VERIFICATION_OPTIONS = [
  { value: "", label: "Any verification" },
  { value: "VERIFIED", label: "Verified" },
  { value: "PENDING", label: "Pending" },
  { value: "REJECTED", label: "Rejected" }
];

const LEGAL_STATUS_OPTIONS = [
  { value: "", label: "Any legal status" },
  { value: "CLEAR", label: "Clear" },
  { value: "ENCUMBERED", label: "Encumbered" },
  { value: "DISPUTED", label: "Disputed" }
];

interface PropertyFiltersProps {
  initialValues?: PropertySearchFilters;
  loading?: boolean;
  onSubmit: (values: PropertySearchFilters) => void;
  onClear: () => void;
}

export function PropertyFilters({
  initialValues = EMPTY_PROPERTY_SEARCH_FILTERS,
  loading = false,
  onSubmit,
  onClear
}: PropertyFiltersProps) {
  const formId = useId();
  const [filters, setFilters] = useState<PropertySearchFilters>(initialValues);

  function update<K extends keyof PropertySearchFilters>(
    key: K,
    value: PropertySearchFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleClear() {
    setFilters(EMPTY_PROPERTY_SEARCH_FILTERS);
    onClear();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(filters);
  }

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className="rounded-xl border border-border-subtle bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3.5 sm:px-5">
        <Icons.Search className="h-5 w-5 text-text-secondary" />
        <h2
          id={`${formId}-title`}
          className="text-base font-semibold text-text-primary"
        >
          Property Filters
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
        <Field label="Search" htmlFor={`${formId}-q`}>
          <div className="relative">
            <Icons.Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id={`${formId}-q`}
              type="text"
              value={filters.q}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Property ID, name, deed, address, or owner…"
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface py-2 pr-3 pl-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="District" htmlFor={`${formId}-district`}>
            <input
              id={`${formId}-district`}
              type="text"
              value={filters.district}
              onChange={(event) => update("district", event.target.value)}
              placeholder="e.g. Business Bay"
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
          </Field>

          <Field label="City" htmlFor={`${formId}-city`}>
            <input
              id={`${formId}-city`}
              type="text"
              value={filters.city}
              onChange={(event) => update("city", event.target.value)}
              placeholder="e.g. Dubai"
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
          </Field>

          <Field label="Land type" htmlFor={`${formId}-land`}>
            <select
              id={`${formId}-land`}
              value={filters.landType}
              onChange={(event) => update("landType", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {LAND_TYPE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Usage" htmlFor={`${formId}-usage`}>
            <select
              id={`${formId}-usage`}
              value={filters.usageType}
              onChange={(event) => update("usageType", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {USAGE_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Verification" htmlFor={`${formId}-verification`}>
            <select
              id={`${formId}-verification`}
              value={filters.verificationStatus}
              onChange={(event) =>
                update("verificationStatus", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Legal status" htmlFor={`${formId}-legal`}>
            <select
              id={`${formId}-legal`}
              value={filters.legalStatus}
              onChange={(event) => update("legalStatus", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {LEGAL_STATUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClear}
            disabled={loading}
            className="inline-flex h-10 items-center rounded-lg px-3.5 text-xs font-semibold tracking-wide text-text-muted uppercase transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:opacity-60"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold tracking-wide text-text-inverse uppercase shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <Icons.Search className="h-4 w-4" />
            {loading ? "Searching…" : "Search Properties"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold tracking-wider text-text-muted uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
