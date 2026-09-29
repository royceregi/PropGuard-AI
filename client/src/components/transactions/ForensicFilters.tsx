"use client";

import { useId, useState, type FormEvent } from "react";
import { Icons } from "@/components/icons";
import {
  EMPTY_TRANSACTION_SEARCH_FILTERS,
  type TransactionSearchFilters
} from "@/lib/transactions/types";

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "Existing Properties", label: "Existing Properties" },
  { value: "Off-Plan Properties", label: "Off-Plan Properties" }
];

const AREA_OPTIONS = [
  "Business Bay",
  "Marsa Dubai",
  "Al Barsha South Fourth",
  "Burj Khalifa",
  "Al Thanyah Fifth",
  "Al Merkadh",
  "Hadaeq Sheikh Mohammed Bin Rashid",
  "Wadi Al Safa 5"
];

const USAGE_OPTIONS = [{ value: "", label: "Any" }];

interface ForensicFiltersProps {
  initialValues?: TransactionSearchFilters;
  loading?: boolean;
  onSubmit: (values: TransactionSearchFilters) => void;
  onClear: () => void;
}

export function ForensicFilters({
  initialValues = EMPTY_TRANSACTION_SEARCH_FILTERS,
  loading = false,
  onSubmit,
  onClear
}: ForensicFiltersProps) {
  const formId = useId();
  const [filters, setFilters] =
    useState<TransactionSearchFilters>(initialValues);

  function update<K extends keyof TransactionSearchFilters>(
    key: K,
    value: TransactionSearchFilters[K]
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleClear() {
    setFilters(EMPTY_TRANSACTION_SEARCH_FILTERS);
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
        <Icons.FilterList className="h-5 w-5 text-text-secondary" />
        <h2
          id={`${formId}-title`}
          className="text-base font-semibold text-text-primary"
        >
          Forensic Filters
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Transaction ID" htmlFor={`${formId}-txn`}>
            <div className="relative">
              <Icons.Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id={`${formId}-txn`}
                type="text"
                value={filters.transactionId}
                onChange={(event) =>
                  update("transactionId", event.target.value)
                }
                placeholder="e.g. TXN-8924A..."
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface py-2 pr-3 pl-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
              />
            </div>
          </Field>

          <Field label="Property Type" htmlFor={`${formId}-type`}>
            <select
              id={`${formId}-type`}
              value={filters.propertyType}
              onChange={(event) => update("propertyType", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {PROPERTY_TYPES.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Area" htmlFor={`${formId}-area`}>
            <select
              id={`${formId}-area`}
              value={filters.area}
              onChange={(event) => update("area", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              <option value="">All Areas</option>
              {AREA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Date Range" htmlFor={`${formId}-date`}>
            <div className="relative">
              <input
                id={`${formId}-date`}
                type="date"
                value={filters.dateRange}
                onChange={(event) => update("dateRange", event.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 pr-10 text-sm text-text-primary outline-none focus:border-primary"
              />
              <Icons.CalendarToday className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Project Name" htmlFor={`${formId}-project`}>
            <input
              id={`${formId}-project`}
              type="text"
              value={filters.projectName}
              onChange={(event) => update("projectName", event.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
          </Field>

          <Field label="Value Range (AED)" htmlFor={`${formId}-min`}>
            <div className="flex items-center gap-2">
              <input
                id={`${formId}-min`}
                type="number"
                min={0}
                value={filters.minValue}
                onChange={(event) => update("minValue", event.target.value)}
                placeholder="Min"
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
              />
              <span className="shrink-0 text-text-muted">–</span>
              <input
                id={`${formId}-max`}
                type="number"
                min={0}
                value={filters.maxValue}
                onChange={(event) => update("maxValue", event.target.value)}
                placeholder="Max"
                aria-label="Maximum value"
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
              />
            </div>
          </Field>

          <Field label="Usage" htmlFor={`${formId}-usage`}>
            <select
              id={`${formId}-usage`}
              value={filters.usage}
              onChange={(event) => update("usage", event.target.value)}
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {USAGE_OPTIONS.map((option) => (
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
            {loading ? "Running…" : "Run Query"}
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
