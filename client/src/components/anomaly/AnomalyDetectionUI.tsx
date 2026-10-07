"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { SummaryCard } from "@/components/risk-analysis/RiskShared";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import {
  CONTAMINATION_OPTIONS,
  formatFeatureValue,
  formatPercent,
  UNUSUAL_Z,
  unusualPercentile,
  type AnomalyModelStatus,
  type AnomalyScore,
  type AnomalyTrainResponse,
  type FeatureDeviation,
  type FlaggedTransactions
} from "@/lib/anomaly/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  shortenId
} from "@/lib/property-search/types";
import { apiErrorMessage } from "@/lib/risk-assessment/types";
import { toast } from "@/lib/toast";

const INPUT_CLASS =
  "h-10 rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-primary";
const PRIMARY_BUTTON =
  "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-text-inverse hover:bg-primary-hover disabled:opacity-60";
const FLAGGED_LIMIT = 50;

function transactionHref(transactionId: string) {
  return `/transactions/${encodeURIComponent(transactionId)}`;
}

function ScoreBar({ score }: { score: number }) {
  const tone =
    score >= 0.99 ? "bg-danger" : score >= 0.95 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-subtle">
        <div
          className={`h-full ${tone}`}
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-text-primary tabular-nums">
        {score.toFixed(3)}
      </span>
    </div>
  );
}

function FeatureChips({ items }: { items: FeatureDeviation[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-text-muted">Combination only</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <StatusBadge
          key={item.feature}
          label={`${item.label} ${item.robust_z != null && item.robust_z > 0 ? "↑" : "↓"}`}
          variant="warning"
          size="sm"
        />
      ))}
    </div>
  );
}

function ModelStateBadge({ status }: { status: AnomalyModelStatus }) {
  if (status.error) return <StatusBadge label="Load error" variant="error" />;
  if (!status.trained)
    return <StatusBadge label="Not trained" variant="neutral" />;
  if (!status.enabled)
    return (
      <StatusBadge label="Trained · not in assessments" variant="warning" />
    );
  return <StatusBadge label="Active in risk assessments" variant="success" />;
}

function ScoreResult({ result }: { result: AnomalyScore }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-text-primary">
          {result.transaction_id}
        </span>
        <StatusBadge
          label={result.is_anomaly ? "Anomalous" : "Typical pattern"}
          variant={result.is_anomaly ? "warning" : "success"}
          size="sm"
        />
        <ScoreBar score={result.anomaly_score} />
        <Link
          href={transactionHref(result.transaction_id)}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-link hover:text-link-hover"
        >
          Open transaction <Icons.OpenInNew className="h-4 w-4" />
        </Link>
      </div>
      <p className="text-sm text-text-secondary">
        More unusual than {unusualPercentile(result.anomaly_score)}% of registry
        transactions.{" "}
        {result.is_anomaly
          ? "Risk assessments add the ANOMALOUS_TRANSACTION_PATTERN indicator for this transaction."
          : "Below the anomaly threshold, so no indicator is added."}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
            <tr>
              <th className="px-3 py-2">Feature</th>
              <th className="px-3 py-2 text-right">This transaction</th>
              <th className="px-3 py-2 text-right">Typical (median)</th>
              <th className="px-3 py-2 text-right">Deviation (z)</th>
            </tr>
          </thead>
          <tbody>
            {result.profile.map((item) => {
              const unusual =
                item.robust_z != null && Math.abs(item.robust_z) >= UNUSUAL_Z;
              return (
                <tr
                  key={item.feature}
                  className="border-t border-border-subtle"
                >
                  <td className="px-3 py-2 text-text-primary">{item.label}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${unusual ? "font-semibold text-warning" : "text-text-primary"}`}
                  >
                    {formatFeatureValue(item.value)}
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary tabular-nums">
                    {formatFeatureValue(item.typical)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${unusual ? "font-semibold text-warning" : "text-text-muted"}`}
                  >
                    {item.robust_z == null ? "—" : item.robust_z.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RetrainPanel({
  current,
  onTrained
}: {
  current: number | null;
  onTrained: () => void;
}) {
  const [contamination, setContamination] = useState(current ?? 0.01);
  const [training, setTraining] = useState(false);

  async function retrain() {
    setTraining(true);
    try {
      const { data } = await api.post<AnomalyTrainResponse>(
        "/api/v1/anomaly-model/train",
        { contamination }
      );
      toast.success(
        `Model retrained on ${data.training_rows.toLocaleString()} transactions; ${data.flagged_total.toLocaleString()} flagged.`
      );
      onTrained();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Training failed."));
    } finally {
      setTraining(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text-primary">Retrain model</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Refit the Isolation Forest on every row of transaction features. Do this
        after importing data or refreshing features. It takes about 10–20
        seconds.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-text-muted">
          Expected anomaly share
          <select
            value={contamination}
            onChange={(event) => setContamination(Number(event.target.value))}
            className={INPUT_CLASS}
            disabled={training}
          >
            {CONTAMINATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatPercent(option)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={retrain}
          disabled={training}
          className={PRIMARY_BUTTON}
        >
          <Icons.Sync className={`h-4 w-4 ${training ? "animate-spin" : ""}`} />
          {training ? "Training…" : "Retrain"}
        </button>
      </div>
    </section>
  );
}

export function AnomalyDetectionUI() {
  const { user } = useAuth();
  const isAdmin = user?.access_level === "SYSTEM";

  const [status, setStatus] = useState<AnomalyModelStatus | null>(null);
  const [flagged, setFlagged] = useState<FlaggedTransactions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [lookupId, setLookupId] = useState("");
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<AnomalyScore | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchModel() {
      const { data } = await api.get<AnomalyModelStatus>(
        "/api/v1/anomaly-model/status"
      );
      const list = data.trained
        ? (
            await api.get<FlaggedTransactions>(
              "/api/v1/anomaly-model/flagged",
              {
                params: { limit: FLAGGED_LIMIT }
              }
            )
          ).data
        : null;
      return { data, list };
    }
    fetchModel()
      .then(({ data, list }) => {
        if (cancelled) return;
        setStatus(data);
        setFlagged(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled)
          setError(apiErrorMessage(err, "Unable to load the anomaly model."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  async function scoreTransaction(transactionId: string) {
    const id = transactionId.trim();
    if (!id) return;
    setLookupId(id);
    setScoring(true);
    setScoreError(null);
    try {
      const { data } = await api.get<AnomalyScore>(
        `/api/v1/anomaly-model/score/${encodeURIComponent(id)}`
      );
      setScoreResult(data);
    } catch (err) {
      setScoreResult(null);
      setScoreError(apiErrorMessage(err, "Unable to score this transaction."));
    } finally {
      setScoring(false);
    }
  }

  function onLookup(event: FormEvent) {
    event.preventDefault();
    void scoreTransaction(lookupId);
  }

  const flaggedShare =
    status?.flagged_total != null && status.training_rows
      ? status.flagged_total / status.training_rows
      : null;

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Anomaly Detection
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-text-secondary">
            An unsupervised Isolation Forest finds transactions whose price,
            turnover, and value-change pattern is unusual compared with the rest
            of the registry. The dataset has no verified fraud labels, so this
            is a signal for investigation, not a fraud judgment.
          </p>
        </div>
        {status ? <ModelStateBadge status={status} /> : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-critical-container p-4 text-sm text-critical"
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Transactions trained on"
          value={status?.training_rows?.toLocaleString() ?? "—"}
          icon={<Icons.QueryStats />}
          tone="primary"
        />
        <SummaryCard
          label={`Flagged (${formatPercent(flaggedShare)})`}
          value={status?.flagged_total?.toLocaleString() ?? "—"}
          icon={<Icons.WarningAmber />}
          tone="warning"
        />
        <SummaryCard
          label="Indicator weight (MEDIUM)"
          value={status ? status.indicator_weight.toFixed(2) : "—"}
          icon={<Icons.GppMaybe />}
          tone="neutral"
        />
        <SummaryCard
          label="Last trained"
          value={status?.trained_at ? formatDate(status.trained_at) : "—"}
          icon={<Icons.History />}
          tone="success"
        />
      </div>

      {status?.error ? (
        <p className="rounded-xl border border-danger/40 bg-critical-container p-4 text-sm text-critical">
          {status.error}
        </p>
      ) : status && !status.trained ? (
        <p className="rounded-xl border border-border bg-surface-subtle p-4 text-sm text-text-secondary">
          The model has not been trained yet.{" "}
          {isAdmin
            ? "Use Retrain below to fit it on the current transaction features."
            : "Ask a Super Admin to train it."}
        </p>
      ) : status && !status.enabled ? (
        <p className="rounded-xl border border-accent-container-alt bg-accent-container p-4 text-sm text-accent">
          The model is trained but risk assessments do not use it yet. Set{" "}
          <code className="font-mono">ANOMALY_MODEL_ENABLED=true</code> in{" "}
          <code className="font-mono">server/.env</code> and restart the API to
          add the {status.indicator_code} indicator. Lookups on this page work
          either way.
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <form
          onSubmit={onLookup}
          className="flex flex-wrap items-end gap-3 p-4"
        >
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-medium text-text-muted">
            Score a transaction
            <input
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="Transaction ID, e.g. 2-13-2022-4439"
              className={`${INPUT_CLASS} font-mono`}
              disabled={!status?.trained}
            />
          </label>
          <button
            type="submit"
            disabled={scoring || !lookupId.trim() || !status?.trained}
            className={PRIMARY_BUTTON}
          >
            <Icons.Search className="h-4 w-4" />
            {scoring ? "Scoring…" : "Score"}
          </button>
        </form>
        {scoreError ? (
          <p
            role="alert"
            className="border-t border-border-subtle p-4 text-sm text-danger"
          >
            {scoreError}
          </p>
        ) : scoreResult ? (
          <ScoreResult result={scoreResult} />
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle p-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Most unusual transactions
            </h2>
            <p className="text-xs text-text-muted">
              From the last training run · ↑ above / ↓ below the registry median
            </p>
          </div>
          <span className="ml-auto text-xs text-text-muted">
            {flagged
              ? `Top ${flagged.items.length} of ${flagged.total.toLocaleString()} flagged`
              : ""}
          </span>
        </div>
        {loading && !flagged ? (
          <p className="p-5 text-sm text-text-muted">Loading…</p>
        ) : !flagged || flagged.items.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">
            {status?.trained
              ? "No transactions were flagged. Retrain the model to rebuild this list."
              : "Train the model to see flagged transactions."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3">Anomaly score</th>
                  <th className="px-4 py-3">Unusual features</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {flagged.items.map((item) => (
                  <tr
                    key={item.transaction_id}
                    className="border-t border-border-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={transactionHref(item.transaction_id)}
                        className="font-mono text-xs text-link hover:text-link-hover"
                      >
                        {item.transaction_id}
                      </Link>
                      {item.property_id ? (
                        <p className="font-mono text-[11px] text-text-muted">
                          {shortenId(item.property_id, 10, 6)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.transaction_group ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                      {formatDateTime(item.transaction_datetime)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.area_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary tabular-nums">
                      {formatMoney(item.transaction_value)}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={item.anomaly_score} />
                    </td>
                    <td className="px-4 py-3">
                      <FeatureChips items={item.unusual_features} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          void scoreTransaction(item.transaction_id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary hover:bg-surface-subtle"
                      >
                        <Icons.FindInPage className="h-4 w-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAdmin ? (
        <RetrainPanel
          key={status?.contamination ?? "untrained"}
          current={status?.contamination ?? null}
          onTrained={reload}
        />
      ) : null}

      {status ? (
        <p className="text-xs text-text-muted">
          Model {status.model_name} {status.model_version} · features:{" "}
          {status.features.map((item) => item.label).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
