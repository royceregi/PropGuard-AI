"use client";

import { useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import {
  formatArea,
  formatMoney,
  propertyHref,
  shortenId,
  statusVariant,
  type PropertyRecord
} from "@/lib/property-search/types";

interface PropertyResultsProps {
  items: PropertyRecord[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  error?: string | null;
  onPageChange: (page: number) => void;
}

function visiblePages(current: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(current - 1, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function PropertyResults({
  items,
  total,
  page,
  pageSize,
  loading = false,
  error = null,
  onPageChange
}: PropertyResultsProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section
      aria-labelledby="property-results-title"
      className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
        <h2
          id="property-results-title"
          className="text-base font-semibold text-text-primary"
        >
          Property Results
        </h2>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-b border-danger/30 bg-critical-container px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Property ID</th>
              <th className="px-4 py-3 whitespace-nowrap">Name / Address</th>
              <th className="px-4 py-3 whitespace-nowrap">Location</th>
              <th className="px-4 py-3 whitespace-nowrap">Type / Usage</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">
                Value (AED)
              </th>
              <th className="px-4 py-3 whitespace-nowrap">Verification</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  Loading properties…
                </td>
              </tr>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  No properties matched these filters.
                </td>
              </tr>
            ) : null}

            {!loading
              ? items.map((row) => {
                  const variant = statusVariant(row.verification_status);
                  const statusLabel = (
                    row.verification_status ?? "Unknown"
                  ).toUpperCase();
                  const title =
                    row.property_name?.trim() ||
                    row.title_deed_number?.trim() ||
                    row.property_id;
                  return (
                    <tr
                      key={row.property_id}
                      className="border-t border-border-subtle transition-colors hover:bg-surface-subtle/60"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={propertyHref(row.property_id)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-link hover:text-link-hover"
                          title={row.property_id}
                        >
                          <Icons.Link className="h-3.5 w-3.5 shrink-0" />
                          {shortenId(row.property_id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-medium text-text-primary">
                          {title}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {row.address?.trim() || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-text-secondary">
                        {[row.district, row.city]
                          .map((part) => part?.trim())
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block text-text-secondary">
                          {row.land_type?.trim() || "—"}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {row.current_usage_type?.trim() ||
                            row.current_subtype?.trim() ||
                            formatArea(row.land_area, row.area_unit)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap text-text-primary tabular-nums">
                        {formatMoney(row.current_value)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge
                          label={statusLabel}
                          variant={variant}
                          size="sm"
                          icon={
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${dotClass(variant)}`}
                            />
                          }
                        />
                      </td>
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={propertyHref(row.property_id)}
                            className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-link transition-colors hover:bg-primary-subtle hover:text-link-hover"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            aria-label={`More actions for ${row.property_id}`}
                            aria-expanded={menuOpenId === row.property_id}
                            onClick={() =>
                              setMenuOpenId((current) =>
                                current === row.property_id
                                  ? null
                                  : row.property_id
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                          >
                            <Icons.MoreVert className="h-5 w-5" />
                          </button>
                        </div>
                        {menuOpenId === row.property_id ? (
                          <div className="absolute top-11 right-4 z-10 min-w-[160px] rounded-lg border border-border-subtle bg-surface py-1 shadow-md">
                            <Link
                              href={propertyHref(row.property_id)}
                              className="block px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-subtle"
                              onClick={() => setMenuOpenId(null)}
                            >
                              View details
                            </Link>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-subtle"
                              onClick={async () => {
                                await navigator.clipboard.writeText(
                                  row.property_id
                                );
                                setMenuOpenId(null);
                              }}
                            >
                              Copy property ID
                            </button>
                            {row.title_deed_number?.trim() ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-subtle"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(
                                    row.title_deed_number!.trim()
                                  );
                                  setMenuOpenId(null);
                                }}
                              >
                                Copy title deed
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-text-muted sm:text-sm">
          {loading
            ? "Loading…"
            : `Showing ${start}-${end} of ${total.toLocaleString()} properties`}
        </p>
        <nav
          className="inline-flex items-center gap-1"
          aria-label="Results pagination"
        >
          <button
            type="button"
            aria-label="Previous page"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icons.ChevronLeft className="h-4 w-4" />
          </button>
          {visiblePages(page, totalPages).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              aria-current={page === pageNumber ? "page" : undefined}
              disabled={loading}
              onClick={() => onPageChange(pageNumber)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
                page === pageNumber
                  ? "bg-primary text-text-inverse"
                  : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={loading || page >= totalPages || total === 0}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icons.ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      </div>
    </section>
  );
}

function dotClass(variant: StatusBadgeVariant): string {
  if (variant === "success") {
    return "bg-success";
  }
  if (variant === "warning") {
    return "bg-accent";
  }
  if (variant === "error") {
    return "bg-danger";
  }
  return "bg-text-muted";
}
