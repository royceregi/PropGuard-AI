"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  AGENT_LABELS,
  type AgentOutput,
  type BlockchainInvestigationResponse,
  type BlockchainRiskAssessment,
  type BlockchainRiskIndicator,
  type RiskLevel
} from "@/lib/blockchain/risk";

export const LEVEL_VARIANT: Record<RiskLevel, StatusBadgeVariant> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error"
};

/** Snapshot of the panel state shared with derived cards. */
export type BlockchainRiskState = {
  assessment: BlockchainRiskAssessment | null;
  loading: boolean;
  running: boolean;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export type BlockchainRiskPanelHandle = {
  /** Start a new investigation and scroll the panel into view. */
  run: () => void;
};

export const BlockchainRiskPanel = forwardRef<
  BlockchainRiskPanelHandle,
  { transactionId: string }
>(function BlockchainRiskPanel({ transactionId }, ref) {
  const sectionRef = useRef<HTMLElement>(null);
  const [assessment, setAssessment] = useState<BlockchainRiskAssessment | null>(
    null
  );
  const [agents, setAgents] = useState<AgentOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<BlockchainRiskAssessment>(
        `/api/v1/blockchain/risk/${encodeURIComponent(transactionId)}`
      )
      .then(({ data }) => {
        if (!cancelled) setAssessment(data);
      })
      .catch(() => {
        if (!cancelled) setAssessment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const { data } = await api.post<BlockchainInvestigationResponse>(
        `/api/v1/blockchain/risk/${encodeURIComponent(transactionId)}`
      );
      setAssessment(data.assessment);
      setAgents(data.agents);
    } catch (err: unknown) {
      setError(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Unable to run the investigation."
      );
    } finally {
      setRunning(false);
    }
  }, [transactionId]);

  useImperativeHandle(
    ref,
    () => ({
      run: () => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        void run();
      }
    }),
    [run]
  );

  return (
    <section
      ref={sectionRef}
      className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Icons.Assessment className="h-[22px] w-[22px] text-text-muted" />
          Blockchain Risk Assessment
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {assessment?.risk_level ? (
            <StatusBadge
              label={`${assessment.risk_level} risk · ${(assessment.risk_score ?? 0).toFixed(2)}`}
              variant={LEVEL_VARIANT[assessment.risk_level]}
              size="md"
            />
          ) : null}
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle disabled:opacity-60"
          >
            <Icons.Sync
              className={`h-4 w-4 ${running ? "animate-spin" : ""}`}
            />
            {running ? "Running…" : assessment ? "Re-run" : "Run"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted">Loading latest assessment…</p>
      ) : !assessment ? (
        <p className="text-sm text-text-muted">
          No assessment yet. Run the investigation to verify the ledger and
          score this transaction.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary">
            {assessment.explanation}
          </p>
          <p className="text-[11px] text-text-muted">
            Integrity {assessment.integrity ?? "—"} · {assessment.model_name}{" "}
            {assessment.model_version}
            {assessment.created_at
              ? ` · ${new Date(assessment.created_at).toLocaleString()}`
              : ""}
            {assessment.stored
              ? ""
              : " · not stored (transaction not in registry)"}
          </p>

          {assessment.indicators.length === 0 ? (
            <p className="text-sm text-success">No risk indicators found.</p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {assessment.indicators.map((indicator) => (
                <IndicatorRow
                  key={indicator.indicator_code}
                  indicator={indicator}
                />
              ))}
            </ul>
          )}

          {agents.length > 0 ? (
            <div className="flex flex-col gap-1 text-[11px] text-text-muted">
              {agents.map((agent) => (
                <p key={agent.agent_name}>
                  <span className="font-semibold text-text-secondary">
                    {AGENT_LABELS[agent.agent_name] ?? agent.agent_name}
                  </span>
                  : {agent.status.toLowerCase()} · confidence{" "}
                  {Math.round(agent.confidence_score * 100)}% ·{" "}
                  {agent.evidence_ids.length} evidence record(s)
                  {agent.warnings.length
                    ? ` · ${agent.warnings.join(" ")}`
                    : ""}
                </p>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-text-muted">
            This is a risk indicator for investigation, not a legal fraud
            judgment.
          </p>
        </div>
      )}
    </section>
  );
});

function IndicatorRow({ indicator }: { indicator: BlockchainRiskIndicator }) {
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="w-24 shrink-0">
        {indicator.severity ? (
          <StatusBadge
            label={indicator.severity}
            variant={LEVEL_VARIANT[indicator.severity]}
            size="sm"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">
          {indicator.indicator_name ?? indicator.indicator_code}{" "}
          <span className="font-mono text-[11px] text-text-muted">
            {indicator.indicator_code} · +
            {(indicator.indicator_value ?? 0).toFixed(2)}
          </span>
        </p>
        <p className="text-xs text-text-secondary">{indicator.description}</p>
        {indicator.evidence.length > 0 ? (
          <ul className="mt-1.5 flex flex-col gap-1 font-mono text-[11px] break-all">
            {indicator.evidence.map((item, index) => (
              <li
                key={`${item.table}-${item.id}-${index}`}
                className="text-text-muted"
              >
                {item.table}
                {item.id ? ` #${item.id}` : ""}
                {item.field ? ` · ${item.field}` : ""}
                {item.expected !== undefined || item.actual !== undefined ? (
                  <>
                    {" "}
                    expected{" "}
                    <span className="text-text-primary">
                      {formatValue(item.expected)}
                    </span>{" "}
                    actual{" "}
                    <span className="text-text-primary">
                      {formatValue(item.actual)}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
