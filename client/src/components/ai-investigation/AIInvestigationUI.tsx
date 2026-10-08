"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  PIPELINE_AGENTS,
  type InvestigationPipelineResponse
} from "@/lib/ai-investigation/types";

interface RecentTransactionOption {
  transaction_id: string;
  property_id?: string | null;
  registration_type?: string | null;
  status?: string | null;
}

export function AIInvestigationUI() {
  const searchParams = useSearchParams();
  const initialTxId = searchParams.get("transaction_id") ?? "";

  const [transactionId, setTransactionId] = useState(initialTxId);
  const [activeTab, setActiveTab] = useState<
    "pipeline" | "dossier" | "evidence"
  >("pipeline");
  const [loading, setLoading] = useState(() => Boolean(initialTxId));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationPipelineResponse | null>(
    null
  );
  const [recentTxList, setRecentTxList] = useState<RecentTransactionOption[]>(
    []
  );
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const executeInvestigation = useCallback(
    async (idToInvestigate?: string) => {
      const targetId = (idToInvestigate || transactionId).trim();
      if (!targetId) {
        setError("Please provide a valid transaction ID to investigate.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data } = await api.post<InvestigationPipelineResponse>(
          `/api/v1/investigations/${encodeURIComponent(targetId)}`
        );
        setResult(data);
        const hasRisk =
          data.assessment?.risk_level === "HIGH" ||
          data.assessment?.risk_level === "MEDIUM";
        setActiveTab(hasRisk ? "dossier" : "pipeline");
      } catch (err) {
        setResult(null);
        setError(
          isAxiosError(err) && err.response?.status === 404
            ? `Transaction "${targetId}" not found in property ledger or blockchain records.`
            : isAxiosError(err) &&
                typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "An unexpected error occurred while executing the multi-agent investigation pipeline."
        );
      } finally {
        setLoading(false);
      }
    },
    [transactionId]
  );

  // Load sample recent transactions for quick investigator selection
  useEffect(() => {
    let cancelled = false;
    async function loadRecent() {
      try {
        const { data } = await api.get<{ items: RecentTransactionOption[] }>(
          "/api/v1/property-transactions/",
          { params: { limit: 6 } }
        );
        if (!cancelled && data.items?.length) {
          setRecentTxList(data.items);
        }
      } catch {
        // Silent fallback - quick selection is an optional enhancement
      }
    }
    void loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-run if transaction_id is present in query parameters
  useEffect(() => {
    if (!initialTxId) return;
    let cancelled = false;

    async function runInitial() {
      try {
        const { data } = await api.post<InvestigationPipelineResponse>(
          `/api/v1/investigations/${encodeURIComponent(initialTxId.trim())}`
        );
        if (!cancelled) {
          setResult(data);
          const hasRisk =
            data.assessment?.risk_level === "HIGH" ||
            data.assessment?.risk_level === "MEDIUM";
          setActiveTab(hasRisk ? "dossier" : "pipeline");
        }
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(
            isAxiosError(err) && err.response?.status === 404
              ? `Transaction "${initialTxId}" not found in property ledger or blockchain records.`
              : isAxiosError(err) &&
                  typeof err.response?.data?.detail === "string"
                ? err.response.data.detail
                : "An unexpected error occurred while executing the multi-agent investigation pipeline."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void runInitial();
    return () => {
      cancelled = true;
    };
  }, [initialTxId]);

  function handleSelectRecent(id: string) {
    setTransactionId(id);
    void executeInvestigation(id);
  }

  function getRiskBadgeVariant(level?: string | null): StatusBadgeVariant {
    switch (level?.toUpperCase()) {
      case "HIGH":
        return "error";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "success";
      default:
        return "neutral";
    }
  }

  function getIntegrityBadgeVariant(status?: string): StatusBadgeVariant {
    switch (status?.toUpperCase()) {
      case "VALID":
      case "MATCH":
      case "PASS":
        return "success";
      case "WARN":
        return "warning";
      case "INVALID":
      case "MISMATCH":
      case "FAIL":
        return "error";
      default:
        return "neutral";
    }
  }

  const assessment = result?.assessment;
  const report = result?.report;
  const agents = result?.agents ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      {/* Header & Breadcrumbs */}
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "AI Investigation Console" }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icons.AutoAwesome className="h-5 w-5" />
              </span>
              AI Investigation Console
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Autonomous 4-agent forensics pipeline: Blockchain Retrieval →
              Transaction Analysis → Risk Scoring → Report Synthesis.
            </p>
          </div>
          {result && (
            <div className="flex items-center gap-2">
              <Link
                href={`/investigation-reports/${encodeURIComponent(result.query_id)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle"
              >
                <Icons.Description className="h-4 w-4 text-text-muted" />
                View Full Stored Report
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Launch & Input Card */}
      <section className="rounded-xl border border-border bg-surface p-5 shadow-xs">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executeInvestigation();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label
              htmlFor="transaction-id-input"
              className="text-xs font-bold tracking-wider text-text-secondary uppercase"
            >
              Target Transaction Identifier
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Icons.ReceiptLong className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="transaction-id-input"
                  type="text"
                  value={transactionId}
                  onChange={(e) => {
                    setTransactionId(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. TX10231 or TX-2023-10425"
                  className="h-11 w-full rounded-lg border border-border bg-background py-2 pr-4 pl-10 font-mono text-sm text-text-primary placeholder:font-sans placeholder:text-text-muted focus:border-primary focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !transactionId.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Icons.Sync className="h-4 w-4 animate-spin" />
                    Investigating Pipeline…
                  </>
                ) : (
                  <>
                    <Icons.AutoAwesome className="h-4 w-4" />
                    Run 4-Agent Pipeline
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Select Chips */}
          {recentTxList.length > 0 && !loading && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
              <span className="text-xs text-text-muted">Quick Pick:</span>
              {recentTxList.map((tx) => (
                <button
                  key={tx.transaction_id}
                  type="button"
                  onClick={() => handleSelectRecent(tx.transaction_id)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                    transactionId === tx.transaction_id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-surface-subtle text-text-secondary hover:border-primary/50 hover:text-text-primary"
                  }`}
                >
                  {tx.transaction_id}
                </button>
              ))}
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-critical-container p-3 text-sm text-danger">
            <Icons.WarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </section>

      {/* Loading Execution State */}
      {loading && (
        <section className="rounded-xl border border-border bg-surface p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icons.AutoAwesome className="h-8 w-8 animate-spin" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-text-primary">
            Running 4-Agent Autonomous Investigation…
          </h3>
          <p className="mt-1 text-sm text-text-secondary max-w-lg mx-auto">
            Retrieval Agent is collecting ledger blocks and document hashes;
            Transaction Analysis Agent is validating party credentials; Risk
            Agent is executing anomaly models.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {PIPELINE_AGENTS.map((agent) => (
              <div
                key={agent.key}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-medium text-text-secondary"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[10px]">
                  {agent.stepNumber}
                </span>
                <span>{agent.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Investigation Results */}
      {result && !loading && (
        <div className="flex flex-col gap-6">
          {/* Executive Overview Banner */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Risk Assessment Score Card */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                  Risk Level
                </span>
                <StatusBadge
                  label={
                    assessment?.risk_level ??
                    report?.risk_summary.risk_level ??
                    "UNKNOWN"
                  }
                  variant={getRiskBadgeVariant(
                    assessment?.risk_level ?? report?.risk_summary.risk_level
                  )}
                  size="sm"
                />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-text-primary">
                  {(
                    (assessment?.risk_score ??
                      report?.risk_summary.risk_score ??
                      0) * 100
                  ).toFixed(0)}
                  %
                </span>
                <span className="text-xs text-text-muted">
                  Score:{" "}
                  {(
                    assessment?.risk_score ??
                    report?.risk_summary.risk_score ??
                    0
                  ).toFixed(2)}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full transition-all duration-500 ${
                    (assessment?.risk_score ?? 0) >= 0.7
                      ? "bg-danger"
                      : (assessment?.risk_score ?? 0) >= 0.4
                        ? "bg-warning"
                        : "bg-success"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (assessment?.risk_score ?? 0) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* Blockchain Ledger Integrity */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                  Ledger Integrity
                </span>
                <StatusBadge
                  label={
                    report?.verification_summary.ledger_integrity ?? "UNKNOWN"
                  }
                  variant={getIntegrityBadgeVariant(
                    report?.verification_summary.ledger_integrity
                  )}
                  size="sm"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Icons.ViewInAr className="h-6 w-6 text-text-muted" />
                <span className="text-base font-semibold text-text-primary">
                  {report?.verification_summary.ledger_integrity === "VALID"
                    ? "Cryptographically Intact"
                    : "Anomaly / Tamper Detected"}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Verified against SHA-256 chain anchors.
              </p>
            </div>

            {/* Document Hash Validation */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                  Document Hashes
                </span>
                <StatusBadge
                  label={
                    report?.verification_summary.document_hash_status ??
                    "UNCHECKED"
                  }
                  variant={getIntegrityBadgeVariant(
                    report?.verification_summary.document_hash_status
                  )}
                  size="sm"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Icons.Description className="h-6 w-6 text-text-muted" />
                <span className="text-base font-semibold text-text-primary">
                  {report?.verification_summary.document_hash_status === "MATCH"
                    ? "Title Deed Match"
                    : report?.verification_summary.document_hash_status ===
                        "MISMATCH"
                      ? "Mismatch / Altered"
                      : "No Documents Anchored"}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Registry deed text matches blockchain hash.
              </p>
            </div>

            {/* Registry Ownership Check */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                  Registry Status
                </span>
                <StatusBadge
                  label={
                    report?.verification_summary.registry_checks_overall ??
                    "PASS"
                  }
                  variant={getIntegrityBadgeVariant(
                    report?.verification_summary.registry_checks_overall
                  )}
                  size="sm"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Icons.AccountBalance className="h-6 w-6 text-text-muted" />
                <span className="text-base font-semibold text-text-primary">
                  {report?.verification_summary.registry_checks_overall ===
                  "PASS"
                    ? "Owner Match Confirmed"
                    : "Review Flagged"}
                </span>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                Seller identity aligns with title record.
              </p>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("pipeline")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === "pipeline"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icons.SmartToy className="h-4 w-4" />
              Multi-Agent Pipeline ({agents.length} Agents)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dossier")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === "dossier"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icons.Description className="h-4 w-4" />
              Executive Dossier &amp; Findings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("evidence")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                activeTab === "evidence"
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icons.FolderOpen className="h-4 w-4" />
              Evidence &amp; Cross-Links
            </button>
          </div>

          {/* Tab 1: Multi-Agent Pipeline Visualization */}
          {activeTab === "pipeline" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {PIPELINE_AGENTS.map((meta) => {
                  const agentData = agents.find(
                    (a) =>
                      a.agent_name === meta.name ||
                      a.agent_name.includes(meta.key)
                  );
                  const isExpanded = expandedAgent === meta.key;

                  return (
                    <article
                      key={meta.key}
                      className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            0{meta.stepNumber}
                          </span>
                          <div>
                            <h3 className="text-base font-bold text-text-primary">
                              {meta.label}
                            </h3>
                            <p className="mt-0.5 text-xs text-text-secondary">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                        <StatusBadge
                          label={agentData?.status ?? "SUCCESS"}
                          variant={
                            agentData?.status === "SUCCESS" ||
                            agentData?.status === "COMPLETED"
                              ? "success"
                              : agentData?.status === "FAILED"
                                ? "error"
                                : "info"
                          }
                          size="sm"
                        />
                      </div>

                      {/* Confidence & Evidence stats */}
                      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg bg-surface-subtle p-3 text-xs">
                        <div>
                          <span className="text-text-muted">Confidence: </span>
                          <span className="font-semibold text-text-primary">
                            {agentData?.confidence_score != null
                              ? `${(agentData.confidence_score * 100).toFixed(1)}%`
                              : "100%"}
                          </span>
                        </div>
                        {agentData?.evidence_ids && (
                          <div>
                            <span className="text-text-muted">
                              Evidence Anchors:{" "}
                            </span>
                            <span className="font-semibold text-text-primary">
                              {agentData.evidence_ids.length} records
                            </span>
                          </div>
                        )}
                        {agentData?.warnings &&
                          agentData.warnings.length > 0 && (
                            <div className="text-warning font-medium">
                              {agentData.warnings.length} warning(s)
                            </div>
                          )}
                      </div>

                      {/* Expandable JSON / Findings Inspection */}
                      {agentData?.findings &&
                        Object.keys(agentData.findings).length > 0 && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAgent(isExpanded ? null : meta.key)
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <Icons.Tune className="h-3.5 w-3.5" />
                              {isExpanded
                                ? "Hide Agent Payload"
                                : "Inspect Agent Payload"}
                            </button>
                            {isExpanded && (
                              <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/90 p-3 font-mono text-[11px] text-gray-200">
                                {JSON.stringify(agentData.findings, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Executive Dossier & Findings */}
          {activeTab === "dossier" && (
            <div className="flex flex-col gap-6">
              {/* Executive Summary & Recommendation */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-border bg-surface p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-text-primary">
                    <Icons.Assessment className="h-5 w-5 text-text-muted" />
                    Executive Summary
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {report?.executive_summary ||
                      `Investigation of transaction ${result.transaction_id} concluded with risk level ${assessment?.risk_level ?? "LOW"}. Verification checks were evaluated across registered deed and ledger anchors.`}
                  </p>
                </section>

                <section className="rounded-xl border border-border bg-surface p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-text-primary">
                    <Icons.Gavel className="h-5 w-5 text-text-muted" />
                    Actionable Registry Recommendation
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                    {report?.recommendation ||
                      "Proceed with standard workflow. No high-severity tamper indications or party mismatches found."}
                  </p>
                </section>
              </div>

              {/* Detected Indicators & Anomalies */}
              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-base font-bold text-text-primary">
                    <Icons.WarningAmber className="h-5 w-5 text-text-muted" />
                    Detected Risk Indicators &amp; Anomaly Signals
                  </h3>
                  <span className="text-xs font-semibold text-text-muted">
                    {assessment?.indicators?.length ??
                      report?.findings?.length ??
                      0}{" "}
                    Flagged
                  </span>
                </div>

                {(assessment?.indicators?.length ??
                  report?.findings?.length ??
                  0) === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-text-primary">
                    <Icons.CheckCircle className="h-5 w-5 text-success" />
                    <span>
                      No anomalous indicators or policy violations were detected
                      for this transaction.
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {assessment?.indicators?.map((indicator, index) => (
                      <div
                        key={index}
                        className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            label={indicator.severity ?? "MEDIUM"}
                            variant={getRiskBadgeVariant(indicator.severity)}
                            size="sm"
                          />
                          <span className="font-mono text-xs font-bold text-text-primary">
                            {indicator.indicator_code}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary">
                          {indicator.description}
                        </p>
                        {indicator.evidence &&
                          indicator.evidence.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="text-[11px] text-text-muted">
                                Evidence:
                              </span>
                              {indicator.evidence.map((ev, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-text-secondary"
                                >
                                  {ev.table}:{ev.id}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Tab 3: Evidence & Cross-Links */}
          {activeTab === "evidence" && (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-text-primary">
                <Icons.FolderOpen className="h-5 w-5 text-text-muted" />
                Supporting Forensic Data &amp; Direct Actions
              </h3>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">Query ID</span>
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {result.query_id}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Transaction ID
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {result.transaction_id}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-text-muted">
                    Target Property ID
                  </span>
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {report?.property_id ?? "—"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Link
                  href={`/transactions/${encodeURIComponent(result.transaction_id)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle"
                >
                  <Icons.ReceiptLong className="h-4 w-4 text-text-muted" />
                  Inspect Full Transaction
                </Link>
                {report?.property_id && (
                  <Link
                    href={`/property-search/${encodeURIComponent(report.property_id)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle"
                  >
                    <Icons.LocationCity className="h-4 w-4 text-text-muted" />
                    Inspect Property Record
                  </Link>
                )}
                <Link
                  href={`/blockchain-verification?transaction_id=${encodeURIComponent(result.transaction_id)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle"
                >
                  <Icons.ViewInAr className="h-4 w-4 text-text-muted" />
                  Verify on Ledger
                </Link>
                <Link
                  href={`/investigation-reports/${encodeURIComponent(result.query_id)}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <Icons.Description className="h-4 w-4" />
                  Open Stored Report Dossier
                </Link>
              </div>
            </section>
          )}

          {/* Responsible AI Notice */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-4 text-xs text-text-secondary">
            <Icons.Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              <strong className="text-text-primary">
                Responsible AI Disclaimer:
              </strong>{" "}
              {result.notice ||
                "This assessment identifies potential anomalies and risk indicators for land-registry investigation purposes. It does not establish that fraud has occurred and does not constitute a legal fraud judgment. Human review is required."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
