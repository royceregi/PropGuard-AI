"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDateTime, shortenId } from "@/lib/property-search/types";

interface AgentRun {
  agent_run_id: number;
  query_id: string;
  agent_name: string;
  status: string;
  confidence_score: number;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
}

interface Evidence {
  transaction_id: string | null;
  document_id: number | null;
  rank: number;
  relevance_score: number;
}

interface InvestigationReport {
  query_id: string;
  user_id: string;
  query_text: string;
  agent_used: string;
  confidence_score: number | null;
  relevance_score: number | null;
  flagged_suspicious: boolean | null;
  response_time_ms: number | null;
  agent_response: string | null;
  log_timestamp: string | null;
  agent_runs: AgentRun[];
  evidence: Evidence[];
}

export function InvestigationReportDetailUI({ queryId }: { queryId: string }) {
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (!queryId || queryId === "undefined" || queryId.trim() === "") {
      if (!hasInitializedRef.current) {
        setLoading(false);
        setError("Investigation report not found.");
        hasInitializedRef.current = true;
      }
      return;
    }

    async function fetchReport() {
      try {
        const { data } = await api.get<InvestigationReport>(
          `/api/v1/investigations/query/${encodeURIComponent(queryId.trim())}`
        );
        if (cancelled) {
          return;
        }
        setReport({
          ...data,
          agent_runs: data.agent_runs || [],
          evidence: data.evidence || []
        });
        setError(null);
        hasInitializedRef.current = true;
      } catch (err) {
        if (cancelled) {
          return;
        }
        setReport(null);
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? "Investigation report not found."
            : isAxiosError(err) &&
                typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to load investigation report."
        );
        hasInitializedRef.current = true;
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchReport();
    return () => {
      cancelled = true;
    };
  }, [queryId]);

  if (loading) {
    return (
      <p className="text-sm text-text-muted">Loading investigation report…</p>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link
          href="/investigation-reports"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-4 w-4" />
          Back to investigation reports
        </Link>
        <p role="alert" className="text-sm text-danger">
          {error ?? "Investigation report not found."}
        </p>
      </div>
    );
  }

  function extractTransactionId(
    queryText?: string | null,
    evs?: Evidence[]
  ): string {
    const match = queryText?.match(/investigate:(.+)/i);
    if (match && match[1]?.trim()) {
      return match[1].trim();
    }
    const fromEv = evs?.find((e) => e.transaction_id)?.transaction_id;
    if (fromEv) return fromEv;
    return "—";
  }

  const transactionId = extractTransactionId(
    report.query_text,
    report.evidence
  );

  function getStatusVariant(
    status: string
  ): "success" | "warning" | "error" | "neutral" {
    const s = status.toUpperCase();
    if (s === "COMPLETED" || s === "SUCCESS") return "success";
    if (s === "FAILED" || s === "ERROR") return "error";
    if (s === "RUNNING" || s === "PENDING") return "warning";
    return "neutral";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Investigation Reports", href: "/investigation-reports" },
            { label: report.query_id }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              Investigation Report
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                label={
                  report.flagged_suspicious ? "Suspicious" : "Not Suspicious"
                }
                variant={report.flagged_suspicious ? "error" : "success"}
                size="md"
                icon={
                  report.flagged_suspicious ? (
                    <Icons.WarningAmber />
                  ) : (
                    <Icons.GppGood />
                  )
                }
              />
              {report.confidence_score !== null ? (
                <StatusBadge
                  label={`${(report.confidence_score * 100).toFixed(1)}% Confidence`}
                  variant="neutral"
                  size="md"
                />
              ) : null}
            </div>
            <p className="mt-2 font-mono text-xs break-all text-text-muted">
              Query ID: {report.query_id}
            </p>
          </div>
          {transactionId !== "—" ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-0">
              <Link
                href={`/transactions/${encodeURIComponent(transactionId)}`}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 font-medium text-text-primary transition-colors hover:bg-surface-subtle"
              >
                <Icons.ReceiptLong className="h-[18px] w-[18px]" />
                View Transaction
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Description className="h-[22px] w-[22px] text-text-muted" />
              Investigation Details
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Detail label="Query ID" value={report.query_id} mono />
              <Detail
                label="Transaction ID"
                value={transactionId}
                mono
                href={`/transactions/${encodeURIComponent(transactionId)}`}
              />
              <Detail label="User ID" value={report.user_id} mono />
              <Detail label="Agent Used" value={report.agent_used} />
              <Detail label="Query Text" value={report.query_text} />
              <Detail
                label="Response Time"
                value={
                  report.response_time_ms
                    ? `${report.response_time_ms}ms`
                    : null
                }
              />
              <Detail
                label="Timestamp"
                value={
                  report.log_timestamp
                    ? formatDateTime(report.log_timestamp)
                    : null
                }
                mono
              />
              <Detail
                label="Flagged Suspicious"
                value={report.flagged_suspicious ? "Yes" : "No"}
              />
            </div>
            {report.agent_response ? (
              <div className="mt-6">
                <span className="mb-2 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Agent Response
                </span>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">
                  {report.agent_response}
                </p>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.SmartToy className="h-[22px] w-[22px] text-text-muted" />
              Agent Execution History
            </h2>
            {report.agent_runs.length === 0 ? (
              <p className="text-sm text-text-muted">
                No agent runs recorded for this investigation.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                    <tr>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Confidence</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.agent_runs.map((run) => (
                      <tr
                        key={run.agent_run_id}
                        className="border-t border-border-subtle"
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {run.agent_name}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={run.status}
                            variant={getStatusVariant(run.status)}
                            size="sm"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-primary">
                          {(run.confidence_score * 100).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {run.started_at
                            ? formatDateTime(run.started_at)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {run.completed_at
                            ? formatDateTime(run.completed_at)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.FolderOpen className="h-[22px] w-[22px] text-text-muted" />
              Retrieved Evidence
            </h2>
            {report.evidence.length === 0 ? (
              <p className="text-sm text-text-muted">
                No evidence records retrieved for this investigation.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Transaction ID</th>
                      <th className="px-4 py-3">Document ID</th>
                      <th className="px-4 py-3">Relevance Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.evidence.map((ev, index) => (
                      <tr key={index} className="border-t border-border-subtle">
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {ev.rank}
                        </td>
                        <td className="px-4 py-3">
                          {ev.transaction_id ? (
                            <Link
                              href={`/transactions/${encodeURIComponent(ev.transaction_id)}`}
                              className="font-mono text-xs text-link hover:text-link-hover"
                            >
                              {shortenId(ev.transaction_id, 8, 6)}
                            </Link>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-muted">
                          {ev.document_id || "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-primary">
                          {(ev.relevance_score * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-1">
          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Info className="h-[22px] w-[22px] text-text-muted" />
              Investigation Summary
            </h2>
            <div className="space-y-4">
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Total Agents Run
                </span>
                <p className="text-lg font-bold text-text-primary">
                  {report.agent_runs.length}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Evidence Retrieved
                </span>
                <p className="text-lg font-bold text-text-primary">
                  {report.evidence.length}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Confidence Score
                </span>
                <p className="text-lg font-bold text-primary">
                  {report.confidence_score !== null
                    ? `${(report.confidence_score * 100).toFixed(1)}%`
                    : "N/A"}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Relevance Score
                </span>
                <p className="text-lg font-bold text-text-primary">
                  {report.relevance_score !== null
                    ? `${(report.relevance_score * 100).toFixed(1)}%`
                    : "N/A"}
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
            <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
              <Icons.Warning className="h-[22px] w-[22px] text-text-muted" />
              Disclaimer
            </h2>
            <p className="text-sm text-text-secondary">
              This investigation report is generated by AI agents and should be
              used as a risk indicator for further investigation. It is not a
              legal fraud judgment. Always verify findings with official records
              before taking any action.
            </p>
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
