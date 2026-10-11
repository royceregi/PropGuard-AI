/** Phase 5 — Information Retrieval (server/app/services/retrieval_service.py). */

export type RetrievalHit = {
  evidence_id: string;
  source:
    | "property"
    | "transaction"
    | "document"
    | "ownership"
    | "assessment"
    | string;
  record_id: string;
  rank: number;
  relevance_score: number;
  /** "identifier" | "related" | "intent" | "full_text" | "full_text_any" */
  match: string;
  intent: string | null;
  title: string;
  subtitle: string | null;
  snippet: string | null;
  property_id: string | null;
  transaction_id: string | null;
  document_id: number | null;
  occurred_at: string | null;
  value: number | null;
};

export type RetrievalInterpreted = {
  transaction_ids: string[];
  property_ids: string[];
  title_deeds: string[];
  intents: string[];
  source_hints: string[];
  date_from: string | null;
  date_to: string | null;
  terms: string;
};

export type RetrievalResponse = {
  query_id: string;
  interpreted: RetrievalInterpreted;
  sources: string[];
  hits: RetrievalHit[];
  counts: Record<string, number>;
  warnings: string[];
  response_time_ms: number;
  ai_answer?: string | null;
  question?: string | null;
  /** "retrieval" when typed on the Evidence Retrieval page, "assistant" when asked in the chat. */
  origin?: "retrieval" | "assistant" | string | null;
};

/** Page that shows one evidence record, or null when there is no detail page for it. */
export function evidenceHref(
  source: string,
  ids: {
    record_id?: string | null;
    property_id?: string | null;
    transaction_id?: string | null;
  }
): string | null {
  if (source === "transaction") {
    const tid = ids.transaction_id ?? ids.record_id;
    return tid ? `/transactions/${encodeURIComponent(tid)}` : null;
  }
  if (source === "property") {
    const pid = ids.property_id ?? ids.record_id;
    return pid ? `/property-search/${encodeURIComponent(pid)}` : null;
  }
  if (source === "document" && ids.property_id) {
    return `/property-search/${encodeURIComponent(ids.property_id)}`;
  }
  return null;
}

export type RetrievalHistoryRow = {
  query_id: string;
  user_id: string;
  query_text: string;
  log_timestamp: string | null;
  confidence_score: number | null;
  relevance_score: number | null;
  flagged_suspicious: boolean | null;
  response_time_ms: number | null;
};

export const INTENT_LABELS: Record<string, string> = {
  previous_owners: "Previous owners",
  high_value: "High-value transactions",
  hash_mismatch: "Document hash mismatches",
  rapid_ownership_change: "Rapid ownership changes",
  high_risk: "High-risk assessments"
};

export const SOURCE_LABELS: Record<string, string> = {
  property: "Property",
  transaction: "Transaction",
  document: "Document",
  ownership: "Ownership",
  assessment: "Risk assessment"
};

export const SOURCE_ICON: Record<string, string> = {
  property: "property",
  transaction: "swap",
  document: "doc",
  ownership: "history",
  assessment: "risk"
};

export function matchLabel(match: string): string {
  switch (match) {
    case "identifier":
      return "Exact";
    case "related":
      return "Related";
    case "intent":
      return "Pattern";
    case "full_text":
      return "Full-text";
    case "full_text_any":
      return "Full-text (partial)";
    default:
      return match;
  }
}

export function matchVariant(
  match: string
): "success" | "info" | "neutral" | "warning" {
  switch (match) {
    case "identifier":
      return "success";
    case "related":
      return "info";
    case "intent":
      return "warning";
    default:
      return "neutral";
  }
}
