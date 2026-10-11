"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDateTime, shortenId } from "@/lib/property-search/types";

interface InvestigationReport {
  query_id: string;
  user_id: string | null;
  query_text: string;
  agent_used: string;
  confidence_score: number | null;
  relevance_score: number | null;
  flagged_suspicious: boolean | null;
  response_time_ms: number | null;
  log_timestamp: string | null;
}

interface PaginatedInvestigations {
  items: InvestigationReport[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

export function InvestigationReportsUI() {
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReports() {
      try {
        const offset = (page - 1) * PAGE_SIZE;
        const { data } = await api.get<PaginatedInvestigations>(
          "/api/v1/investigations",
          { params: { limit: PAGE_SIZE, offset } }
        );
        if (cancelled) {
          return;
        }
        setReports(data.items);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setReports([]);
        setTotal(0);
        setError(
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Unable to load investigation reports."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchReports();
    return () => {
      cancelled = true;
    };
  }, [page]);

  function handlePageChange(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  function visiblePages(current: number, totalPages: number): number[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const startPage = Math.max(1, Math.min(current - 2, totalPages - 4));
    return Array.from({ length: 5 }, (_, index) => startPage + index);
  }

  function extractTransactionId(queryText: string): string {
    const match = queryText.match(/investigate:(.+)/);
    return match ? match[1].trim() : "—";
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Investigation Reports
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          View all AI-generated investigation reports for property transactions.
        </p>
      </div>

      <section
        aria-labelledby="investigation-reports-title"
        className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
          <h2
            id="investigation-reports-title"
            className="text-base font-semibold text-text-primary"
          >
            {loading
              ? "Loading reports…"
              : `${total.toLocaleString()} Report${total === 1 ? "" : "s"}`}
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
                <th className="px-4 py-3 whitespace-nowrap">Query ID</th>
                <th className="px-4 py-3 whitespace-nowrap">Transaction ID</th>
                <th className="px-4 py-3 whitespace-nowrap">User</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Suspicious</th>
                <th className="px-4 py-3 whitespace-nowrap">Confidence</th>
                <th className="px-4 py-3 whitespace-nowrap">Response Time</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-text-muted"
                  >
                    Loading investigation reports…
                  </td>
                </tr>
              ) : null}

              {!loading && !error && reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-text-muted"
                  >
                    No investigation reports found.
                  </td>
                </tr>
              ) : null}

              {!loading && reports.length > 0
                ? reports.map((report) => {
                    const transactionId = extractTransactionId(
                      report.query_text
                    );
                    return (
                      <tr
                        key={report.query_id}
                        className="border-t border-border-subtle transition-colors hover:bg-surface-subtle/60"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs text-text-primary">
                            {report.query_id}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            href={`/transactions/${encodeURIComponent(transactionId)}`}
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-link hover:text-link-hover"
                            title={transactionId}
                          >
                            <Icons.Link className="h-3.5 w-3.5 shrink-0" />
                            {shortenId(transactionId, 8, 6)}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs text-text-muted">
                            {shortenId(report.user_id, 8, 6)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-text-secondary">
                          {report.log_timestamp
                            ? formatDateTime(report.log_timestamp)
                            : "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {report.flagged_suspicious === true ? (
                            <StatusBadge
                              label="Yes"
                              variant="error"
                              size="sm"
                              icon={<Icons.WarningAmber className="h-3 w-3" />}
                            />
                          ) : report.flagged_suspicious === false ? (
                            <StatusBadge
                              label="No"
                              variant="success"
                              size="sm"
                            />
                          ) : (
                            <StatusBadge
                              label="N/A"
                              variant="neutral"
                              size="sm"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {report.confidence_score !== null ? (
                            <span className="font-mono text-xs text-text-primary">
                              {(report.confidence_score * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {report.response_time_ms !== null ? (
                            <span className="font-mono text-xs text-text-primary">
                              {report.response_time_ms}ms
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/investigation-reports/${encodeURIComponent(report.query_id)}`}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-subtle"
                          >
                            <Icons.Visibility className="h-4 w-4" />
                            View Report
                          </Link>
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
              onClick={() => handlePageChange(page - 1)}
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
                onClick={() => handlePageChange(pageNumber)}
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
              onClick={() => handlePageChange(page + 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icons.ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}
