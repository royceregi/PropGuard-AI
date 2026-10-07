"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/risk-assessment/types";
import {
  INTENT_LABELS,
  SOURCE_LABELS,
  matchLabel,
  matchVariant,
  type RetrievalHit,
  type RetrievalHistoryRow,
  type RetrievalResponse
} from "@/lib/retrieval/types";
import { formatDate, formatMoney } from "@/lib/property-search/types";

// ─── constants ──────────────────────────────────────────────────────────────

const INPUT_CLASS =
  "h-10 rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-primary";
const BUTTON_PRIMARY =
  "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-text-inverse hover:bg-primary-hover disabled:opacity-60";
const BUTTON_GHOST =
  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50";

const EXAMPLE_QUERIES = [
  "Find high-value transactions",
  "Documents with hash mismatch",
  "rapid ownership changes",
  "suspicious high risk transactions",
  "villa mortgaged Wadi Al Safa",
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "property", label: "Properties" },
  { value: "transaction", label: "Transactions" },
  { value: "document", label: "Documents" },
];

// ─── sub-components ─────────────────────────────────────────────────────────

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.9
      ? "bg-success"
      : score >= 0.7
        ? "bg-primary"
        : "bg-warning";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-subtle">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-text-muted">{pct}%</span>
    </div>
  );
}

function HitCard({ hit }: { hit: RetrievalHit }) {
  const href =
    hit.source === "transaction" && hit.transaction_id
      ? `/transactions/${encodeURIComponent(hit.transaction_id)}`
      : hit.source === "property" && hit.property_id
        ? `/property-search/${encodeURIComponent(hit.property_id)}`
        : hit.source === "document" && hit.property_id
          ? `/property-search/${encodeURIComponent(hit.property_id)}`
          : null;

  const intentLabel =
    hit.intent && hit.intent in INTENT_LABELS
      ? INTENT_LABELS[hit.intent]
      : hit.intent ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start gap-2">
        <span className="w-5 shrink-0 text-center text-xs font-semibold text-text-muted tabular-nums">
          {hit.rank}
        </span>

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={SOURCE_LABELS[hit.source] ?? hit.source}
              variant="info"
              size="sm"
            />
            <StatusBadge
              label={matchLabel(hit.match)}
              variant={matchVariant(hit.match)}
              size="sm"
            />
            {intentLabel && (
              <StatusBadge label={intentLabel} variant="warning" size="sm" />
            )}
            <RelevanceBar score={hit.relevance_score} />
            {href && (
              <Link
                href={href}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-link hover:text-link-hover"
              >
                Open <Icons.OpenInNew className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {/* Title / subtitle */}
          <p className="mt-1.5 text-sm font-semibold text-text-primary">
            {hit.title}
          </p>
          {hit.subtitle && (
            <p className="text-xs text-text-secondary">{hit.subtitle}</p>
          )}

          {/* Snippet */}
          {hit.snippet && (
            <p
              className="mt-1.5 text-xs text-text-secondary"
              dangerouslySetInnerHTML={{
                __html: hit.snippet.replace(
                  /\[\[([^\]]+)\]\]/g,
                  '<mark class="bg-accent-container text-accent rounded px-0.5">$1</mark>'
                )
              }}
            />
          )}

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
            {hit.evidence_id && (
              <span className="font-mono">{hit.evidence_id}</span>
            )}
            {hit.occurred_at && (
              <span>{formatDate(hit.occurred_at)}</span>
            )}
            {hit.value != null && hit.value > 0 && (
              <span>AED {formatMoney(hit.value)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InterpretedChips({
  interpreted
}: {
  interpreted: RetrievalResponse["interpreted"];
}) {
  const chips: string[] = [];
  if (interpreted.transaction_ids.length)
    chips.push(`${interpreted.transaction_ids.length} transaction ID(s)`);
  if (interpreted.title_deeds.length)
    chips.push(`${interpreted.title_deeds.length} deed(s)`);
  if (interpreted.property_ids.length)
    chips.push(`${interpreted.property_ids.length} property ID(s)`);
  for (const intent of interpreted.intents) {
    chips.push(INTENT_LABELS[intent] ?? intent);
  }
  if (interpreted.terms)
    chips.push(`"${interpreted.terms}"`);
  if (interpreted.date_from)
    chips.push(
      interpreted.date_from === interpreted.date_to
        ? interpreted.date_from.slice(0, 4)
        : `${interpreted.date_from.slice(0, 4)}–${interpreted.date_to?.slice(0, 4) ?? "?"}`
    );
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-text-muted">Interpreted:</span>
      {chips.map((chip) => (
        <StatusBadge key={chip} label={chip} variant="neutral" size="sm" />
      ))}
    </div>
  );
}

function HistoryTable({ rows }: { rows: RetrievalHistoryRow[] }) {
  if (!rows.length)
    return <p className="py-8 text-center text-sm text-text-muted">No recent queries.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-subtle text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          <tr>
            <th className="px-3 py-2">Query</th>
            <th className="px-3 py-2 text-right">Relevance</th>
            <th className="px-3 py-2 text-right">Latency</th>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.query_id} className="border-t border-border-subtle">
              <td className="max-w-xs truncate px-3 py-2 text-text-primary">
                {row.query_text}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                {row.relevance_score != null
                  ? `${Math.round(row.relevance_score * 100)}%`
                  : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                {row.response_time_ms != null ? `${row.response_time_ms} ms` : "—"}
              </td>
              <td className="px-3 py-2 text-text-muted">
                {row.log_timestamp ? formatDate(row.log_timestamp) : "—"}
              </td>
              <td className="px-3 py-2">
                {row.flagged_suspicious && (
                  <StatusBadge label="Suspicious" variant="warning" size="sm" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export function RetrievalUI() {
  const { user } = useAuth();
  const isAuthority =
    user?.access_level === "SYSTEM" ||
    user?.access_level === "REGISTRY" ||
    user?.access_level === "COMPANY";

  const [queryText, setQueryText] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RetrievalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<RetrievalHistoryRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "history">("results");

  const inputRef = useRef<HTMLInputElement>(null);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setQueryText(q);
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveTab("results");
    try {
      const params: Record<string, string> = { q, limit: "20" };
      if (source) params.sources = source;
      const { data } = await api.get<RetrievalResponse>("/api/v1/retrieval/search", { params });
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Search failed. Try rephrasing your query."));
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<RetrievalHistoryRow[]>("/api/v1/retrieval/history", {
        params: { limit: 50 }
      });
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(queryText);
  }

  useEffect(() => {
    if (activeTab === "history" && history === null && isAuthority) {
      loadHistory();
    }
  }, [activeTab, history, isAuthority]);

  const totalHits = result?.hits.length ?? 0;
  const counts = result?.counts ?? {};

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary">
          <Icons.FindInPage className="h-6 w-6 text-primary" />
          Evidence Retrieval
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Natural-language or identifier query across properties, transactions, and documents.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="e.g. Find high-value transactions · TD-DXB-0000623 · villa mortgaged Wadi Al Safa"
            className={`${INPUT_CLASS} flex-1`}
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={`${INPUT_CLASS} sm:w-44`}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button type="submit" disabled={loading || !queryText.trim()} className={BUTTON_PRIMARY}>
            {loading
              ? <Icons.HourglassEmpty className="h-4 w-4 animate-spin" />
              : <Icons.Search className="h-4 w-4" />}
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Example queries */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">Examples:</span>
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setQueryText(ex); runSearch(ex); }}
              className={BUTTON_GHOST}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-critical-container px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      {/* Tabs */}
      {(result || isAuthority) && (
        <div className="mb-4 flex gap-1 border-b border-border">
          {(["results", "history"] as const).filter((t) => t === "results" || isAuthority).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab === "results" ? "Results" : "Query history"}
            </button>
          ))}
        </div>
      )}

      {/* Results tab */}
      {activeTab === "results" && result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface-canvas px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">
              {totalHits} evidence record{totalHits !== 1 ? "s" : ""}
            </span>
            {Object.entries(counts).map(([src, n]) => (
              <StatusBadge
                key={src}
                label={`${SOURCE_LABELS[src] ?? src}: ${n}`}
                variant="neutral"
                size="sm"
              />
            ))}
            <span className="ml-auto text-xs text-text-muted tabular-nums">
              {result.response_time_ms} ms · {result.query_id}
            </span>
          </div>

          {/* Interpreted */}
          <InterpretedChips interpreted={result.interpreted} />

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-accent-container-alt bg-accent-container px-3 py-2 text-xs text-accent"
                >
                  <Icons.WarningAmber className="mt-0.5 h-4 w-4 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Hits */}
          {result.hits.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface py-12 text-center">
              <Icons.FindInPage className="mx-auto mb-3 h-10 w-10 text-text-muted" />
              <p className="text-sm font-medium text-text-primary">No evidence records found</p>
              <p className="mt-1 text-xs text-text-secondary">
                Try a different query, identifier, or source filter.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.hits.map((hit) => (
                <HitCard key={hit.evidence_id} hit={hit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state before first search */}
      {activeTab === "results" && !result && !loading && !error && (
        <div className="rounded-xl border border-border bg-surface py-16 text-center">
          <Icons.FindInPage className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Enter a query above to retrieve evidence</p>
          <p className="mt-1 text-xs text-text-secondary">
            Search by identifier (transaction ID, title deed, property ID) or describe what you are looking for.
          </p>
        </div>
      )}

      {/* History tab */}
      {activeTab === "history" && isAuthority && (
        <div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icons.HourglassEmpty className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : history !== null ? (
            <HistoryTable rows={history} />
          ) : null}
        </div>
      )}
    </div>
  );
}
