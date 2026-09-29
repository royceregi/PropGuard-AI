"use client";

import { useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import {
  formatMoney,
  formatTransactionDate,
  shortenId,
  statusVariant,
  type PropertyTransaction
} from "@/lib/transactions/types";

interface InvestigationResultsProps {
  items: PropertyTransaction[];
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

export function InvestigationResults({
  items,
  total,
  page,
  pageSize,
  loading = false,
  error = null,
  onPageChange
}: InvestigationResultsProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section
      aria-labelledby="investigation-results-title"
      className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
        <h2
          id="investigation-results-title"
          className="text-base font-semibold text-text-primary"
        >
          Investigation Results
        </h2>
        <button
          type="button"
          title="Export coming soon"
          aria-label="Export data (coming soon)"
          disabled
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted opacity-50"
        >
          <Icons.FileDownload className="h-5 w-5" />
        </button>
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
              <th className="px-4 py-3 whitespace-nowrap">Transaction ID</th>
              <th className="px-4 py-3 whitespace-nowrap">Date</th>
              <th className="px-4 py-3 whitespace-nowrap">Type</th>
              <th className="px-4 py-3 whitespace-nowrap">Area / Project</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">
                Value (AED)
              </th>
              <th className="px-4 py-3 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 whitespace-nowrap">Risk</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  Loading investigation results…
                </td>
              </tr>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  No transactions matched these filters.
                </td>
              </tr>
            ) : null}

            {!loading
              ? items.map((row) => {
                  const variant = statusVariant(row.status);
                  const statusLabel = (row.status ?? "Unknown").toUpperCase();
                  return (
                    <tr
                      key={row.transaction_id}
                      className="border-t border-border-subtle transition-colors hover:bg-surface-subtle/60"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Link
                          href={`/transactions/${encodeURIComponent(row.transaction_id)}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-link hover:text-link-hover"
                          title={row.transaction_id}
                        >
                          <Icons.Link className="h-3.5 w-3.5 shrink-0" />
                          {shortenId(row.transaction_id)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-text-secondary">
                        {formatTransactionDate(row.transaction_datetime)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-text-secondary">
                        {row.registration_type ?? row.transaction_group ?? "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-medium text-text-primary">
                          {row.area_name?.trim() || "—"}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {row.project_name?.trim() ||
                            row.master_project?.trim() ||
                            "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium whitespace-nowrap text-text-primary tabular-nums">
                        {formatMoney(row.transaction_value)}
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
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <StatusBadge label="N/A" variant="neutral" size="sm" />
                      </td>
                      <td className="relative px-4 py-3.5 text-right">
                        <button
                          type="button"
                          aria-label={`Actions for ${row.transaction_id}`}
                          aria-expanded={menuOpenId === row.transaction_id}
                          onClick={() =>
                            setMenuOpenId((current) =>
                              current === row.transaction_id
                                ? null
                                : row.transaction_id
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                        >
                          <Icons.MoreVert className="h-5 w-5" />
                        </button>
                        {menuOpenId === row.transaction_id ? (
                          <div className="absolute top-11 right-4 z-10 min-w-[140px] rounded-lg border border-border-subtle bg-surface py-1 shadow-md">
                            <Link
                              href={`/transactions/${encodeURIComponent(row.transaction_id)}`}
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
                                  row.transaction_id
                                );
                                setMenuOpenId(null);
                              }}
                            >
                              Copy ID
                            </button>
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
            : `Showing ${start}-${end} of ${total.toLocaleString()} records`}
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
