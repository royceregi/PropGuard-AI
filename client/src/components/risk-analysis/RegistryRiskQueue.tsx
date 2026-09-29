"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDateTime, shortenId } from "@/lib/property-search/types";
import {
  apiErrorMessage,
  EMPTY_QUEUE_FILTERS,
  requesterTypeLabel,
  STATUS_LABELS,
  type QueueFilters,
  type RegistryQueue,
  type RiskRequestStatus
} from "@/lib/risk-assessment/types";
import { RequestStatusBadge, RiskLevelBadge, SummaryCard } from "./RiskShared";

const FILTER_CLASS =
  "h-10 rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-primary";

export function RegistryRiskQueue() {
  const [filters, setFilters] = useState<QueueFilters>(EMPTY_QUEUE_FILTERS);
  const [queue, setQueue] = useState<RegistryQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
    );
    api
      .get<RegistryQueue>("/api/v1/risk-assessments/queue", {
        params: { ...params, limit: 200 }
      })
      .then(({ data }) => {
        if (!cancelled) {
          setQueue(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(apiErrorMessage(err, "Unable to load the request queue."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const setFilter = <K extends keyof QueueFilters>(
    key: K,
    value: QueueFilters[K]
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Risk Assessment Requests
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review property information submitted by Common and Real Estate users,
          verify it, and send the official risk assessment back.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Pending Intake"
          value={queue?.summary.pending_intake ?? "—"}
          icon={<Icons.Mail />}
          tone="primary"
        />
        <SummaryCard
          label="Under Review"
          value={queue?.summary.under_review ?? "—"}
          icon={<Icons.HourglassEmpty />}
          tone="warning"
        />
        <SummaryCard
          label="Needs Clarification"
          value={queue?.summary.needs_clarification ?? "—"}
          icon={<Icons.WarningAmber />}
          tone="danger"
        />
        <SummaryCard
          label="Completed Today"
          value={queue?.summary.completed_today ?? "—"}
          icon={<Icons.GppGood />}
          tone="success"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-end gap-3 border-b border-border-subtle p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilter(
                  "status",
                  event.target.value as QueueFilters["status"]
                )
              }
              className={FILTER_CLASS}
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABELS) as RiskRequestStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
            User type
            <select
              value={filters.requester_type}
              onChange={(event) =>
                setFilter(
                  "requester_type",
                  event.target.value as QueueFilters["requester_type"]
                )
              }
              className={FILTER_CLASS}
            >
              <option value="">All users</option>
              <option value="PUBLIC">Common User</option>
              <option value="COMPANY">Real Estate</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
            Submitted from
            <input
              type="date"
              value={filters.submitted_from}
              max={filters.submitted_to || undefined}
              onChange={(event) =>
                setFilter("submitted_from", event.target.value)
              }
              className={FILTER_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
            Submitted to
            <input
              type="date"
              value={filters.submitted_to}
              min={filters.submitted_from || undefined}
              onChange={(event) =>
                setFilter("submitted_to", event.target.value)
              }
              className={FILTER_CLASS}
            />
          </label>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_QUEUE_FILTERS)}
              className="h-10 px-2 text-sm font-medium text-link hover:text-link-hover"
            >
              Clear filters
            </button>
          ) : null}
          <span className="ml-auto self-center text-xs text-text-muted">
            {queue
              ? `${queue.total} request${queue.total === 1 ? "" : "s"}`
              : ""}
          </span>
        </div>

        {loading && !queue ? (
          <p className="p-5 text-sm text-text-muted">Loading…</p>
        ) : error ? (
          <p role="alert" className="p-5 text-sm text-danger">
            {error}
          </p>
        ) : !queue || queue.items.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">
            {hasFilters
              ? "No requests match these filters."
              : "No risk assessment requests yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Request ID</th>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Requester</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.items.map((item) => {
                  const done =
                    item.status === "VERIFIED" || item.status === "REJECTED";
                  return (
                    <tr
                      key={item.request_id}
                      className="border-t border-border-subtle"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-text-primary">
                        {item.request_id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">
                          {item.property_title ||
                            shortenId(item.property_id, 8, 6)}
                        </p>
                        <p className="font-mono text-xs text-text-muted">
                          {shortenId(item.property_id, 10, 6)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-primary">
                        {item.requester.full_name || item.requester.user_id}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={requesterTypeLabel(
                            item.requester.access_level
                          )}
                          variant={
                            item.requester.access_level === "COMPANY"
                              ? "info"
                              : "neutral"
                          }
                          size="sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDateTime(item.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        <RequestStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3">
                        <RiskLevelBadge
                          level={item.risk_level}
                          score={item.risk_score}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/risk-analysis/review/${encodeURIComponent(item.request_id)}`}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${
                            done
                              ? "border border-border bg-surface text-text-primary hover:bg-surface-subtle"
                              : "bg-primary text-text-inverse hover:bg-primary-hover"
                          }`}
                        >
                          {done ? (
                            <Icons.Visibility className="h-4 w-4" />
                          ) : (
                            <Icons.FindInPage className="h-4 w-4" />
                          )}
                          {done ? "View" : "Review & Process"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
