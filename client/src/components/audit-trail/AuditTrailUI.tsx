"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  AGENT_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  getAgentDisplayName,
  type AgentRunAuditItem
} from "@/lib/audit-trail/types";
import { formatDateTime } from "@/lib/property-search/types";

export function AuditTrailUI() {
  const [runs, setRuns] = useState<AgentRunAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [searchQueryId, setSearchQueryId] = useState("");

  // Inspect Modal
  const [activeInspectRun, setActiveInspectRun] =
    useState<AgentRunAuditItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRuns() {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = {
          limit: 100,
          offset: 0
        };
        if (selectedAgent) params.agent_name = selectedAgent;
        if (selectedStatus) params.status = selectedStatus;
        if (searchQueryId.trim()) params.query_id = searchQueryId.trim();

        const { data } = await api.get<AgentRunAuditItem[]>(
          "/api/v1/investigations/agent-runs",
          { params }
        );
        if (!cancelled) {
          setRuns(data);
        }
      } catch (err) {
        if (!cancelled) {
          setRuns([]);
          setError(
            isAxiosError(err) && typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : isAxiosError(err) && err.response?.status === 403
                ? "Access denied. Only Super Admin and Land Registry roles can access the agent execution audit trail."
                : "Unable to load agent execution audit logs."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchRuns();
    return () => {
      cancelled = true;
    };
  }, [selectedAgent, selectedStatus, searchQueryId]);

  function getStatusVariant(status: string): StatusBadgeVariant {
    const s = status.toUpperCase();
    if (s === "SUCCESS" || s === "COMPLETED") return "success";
    if (s === "FAILED" || s === "ERROR") return "error";
    if (s === "RUNNING" || s === "PENDING") return "warning";
    return "neutral";
  }

  function calculateLatency(
    started: string | null,
    completed: string | null
  ): string {
    if (!started || !completed) return "—";
    const startMs = new Date(started).getTime();
    const endMs = new Date(completed).getTime();
    const diff = endMs - startMs;
    if (diff < 0) return "—";
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
  }

  // Summary statistics
  const totalCount = runs.length;
  const successCount = runs.filter(
    (r) =>
      r.status.toUpperCase() === "SUCCESS" ||
      r.status.toUpperCase() === "COMPLETED"
  ).length;
  const failureCount = runs.filter(
    (r) =>
      r.status.toUpperCase() === "FAILED" || r.status.toUpperCase() === "ERROR"
  ).length;
  const avgConfidence =
    totalCount > 0
      ? (
          (runs.reduce((acc, r) => acc + (r.confidence_score || 0), 0) /
            totalCount) *
          100
        ).toFixed(1)
      : "100.0";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      {/* Header & Breadcrumbs */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Agent Audit Trail" }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icons.History className="h-5 w-5" />
              </span>
              Agent Execution Audit Trail
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Immutable telemetry log for autonomous AI agent runs, confidence
              metrics, and deterministic verification traces.
            </p>
          </div>
          <Link
            href="/ai-investigation"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover self-start sm:self-auto"
          >
            <Icons.AutoAwesome className="h-4 w-4" />
            Launch New Investigation
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            Total Telemetry Logs
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">
              {totalCount}
            </span>
            <span className="text-xs text-text-muted">recent executions</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            Successful Executions
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-success">
              {successCount}
            </span>
            <span className="text-xs text-text-muted">
              {totalCount > 0
                ? `(${((successCount / totalCount) * 100).toFixed(0)}%)`
                : "—"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            Failed / Errors
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${failureCount > 0 ? "text-danger" : "text-text-primary"}`}
            >
              {failureCount}
            </span>
            <span className="text-xs text-text-muted">action required</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            Mean Confidence
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-primary">
              {avgConfidence}%
            </span>
            <span className="text-xs text-text-muted">
              across active models
            </span>
          </div>
        </div>
      </section>

      {/* Filter & Control Bar */}
      <section className="rounded-xl border border-border bg-surface p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Agent Filter */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="agent-filter"
              className="text-xs font-semibold text-text-secondary"
            >
              Filter by Intelligent Agent
            </label>
            <select
              id="agent-filter"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-text-primary focus:border-primary focus:outline-hidden"
            >
              {AGENT_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status-filter"
              className="text-xs font-semibold text-text-secondary"
            >
              Execution Status
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-xs text-text-primary focus:border-primary focus:outline-hidden"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Query ID Search */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="query-id-search"
              className="text-xs font-semibold text-text-secondary"
            >
              Search Query ID
            </label>
            <div className="relative">
              <Icons.Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="query-id-search"
                type="text"
                value={searchQueryId}
                onChange={(e) => setSearchQueryId(e.target.value)}
                placeholder="e.g. INV-..."
                className="h-10 w-full rounded-lg border border-border bg-background py-1.5 pr-3 pl-9 font-mono text-xs text-text-primary placeholder:font-sans placeholder:text-text-muted focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Audit Log Table */}
      <section className="rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-text-primary">
            <Icons.Tune className="h-4 w-4 text-text-muted" />
            Agent Execution Logs
          </h2>
          <span className="text-xs text-text-muted">
            Showing {runs.length} log records
          </span>
        </div>

        {error && (
          <div className="p-4">
            <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-critical-container p-3 text-sm text-danger">
              <Icons.WarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Icons.Sync className="h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-sm text-text-muted">
              Loading agent audit trail telemetry…
            </p>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <Icons.History className="mx-auto h-8 w-8 text-text-muted" />
            <h3 className="mt-2 text-sm font-semibold text-text-primary">
              No agent runs match criteria
            </h3>
            <p className="mt-1 text-xs text-text-secondary">
              Try adjusting your agent, status, or query ID filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Run ID</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Query Dossier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {runs.map((run) => (
                  <tr
                    key={run.agent_run_id}
                    className="hover:bg-surface-subtle/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">
                      #{run.agent_run_id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-text-primary">
                          {getAgentDisplayName(run.agent_name)}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted">
                          {run.agent_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {run.query_id ? (
                        <Link
                          href={`/investigation-reports/${encodeURIComponent(run.query_id)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {run.query_id}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={run.status}
                        variant={getStatusVariant(run.status)}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-primary">
                      {run.confidence_score != null
                        ? `${(run.confidence_score * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {calculateLatency(run.started_at, run.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                      {run.started_at ? formatDateTime(run.started_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveInspectRun(run)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-surface-subtle hover:border-primary/50 transition-colors"
                      >
                        <Icons.Tune className="h-3 w-3 text-text-muted" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Execution Payload Inspection Drawer / Modal */}
      {activeInspectRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icons.Tune className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Execution Telemetry: Run #{activeInspectRun.agent_run_id}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {getAgentDisplayName(activeInspectRun.agent_name)} (
                    {activeInspectRun.agent_name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveInspectRun(null)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary"
              >
                <Icons.Close className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Status and Metrics Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg bg-surface-subtle p-3 text-xs">
                <div>
                  <span className="text-text-muted block">Status:</span>
                  <StatusBadge
                    label={activeInspectRun.status}
                    variant={getStatusVariant(activeInspectRun.status)}
                    size="sm"
                  />
                </div>
                <div>
                  <span className="text-text-muted block">Confidence:</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {activeInspectRun.confidence_score != null
                      ? `${(activeInspectRun.confidence_score * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Latency:</span>
                  <span className="font-mono text-text-primary">
                    {calculateLatency(
                      activeInspectRun.started_at,
                      activeInspectRun.completed_at
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted block">Query ID:</span>
                  <span className="font-mono text-primary font-semibold">
                    {activeInspectRun.query_id || "—"}
                  </span>
                </div>
              </div>

              {/* Error Message banner if failed */}
              {activeInspectRun.error_message && (
                <div className="rounded-lg border border-danger/30 bg-critical-container p-3 text-xs text-danger">
                  <strong className="block font-semibold">
                    Execution Failure:
                  </strong>
                  {activeInspectRun.error_message}
                </div>
              )}

              {/* Input Data Payload */}
              <div>
                <span className="mb-1 block text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Input Arguments &amp; Parameters
                </span>
                <pre className="max-h-56 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] text-gray-200">
                  {activeInspectRun.input_data
                    ? JSON.stringify(activeInspectRun.input_data, null, 2)
                    : "// No input payload recorded"}
                </pre>
              </div>

              {/* Output Data Payload */}
              <div>
                <span className="mb-1 block text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Output Findings &amp; Evidence
                </span>
                <pre className="max-h-64 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] text-gray-200">
                  {activeInspectRun.output_data
                    ? JSON.stringify(activeInspectRun.output_data, null, 2)
                    : "// No output payload recorded"}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              {activeInspectRun.query_id ? (
                <Link
                  href={`/investigation-reports/${encodeURIComponent(activeInspectRun.query_id)}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View Associated Report Dossier →
                </Link>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setActiveInspectRun(null)}
                className="rounded-lg bg-surface-subtle px-4 py-2 text-xs font-semibold text-text-primary hover:bg-border transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
