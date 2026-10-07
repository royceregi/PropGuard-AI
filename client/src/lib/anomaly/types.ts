/** Optional Isolation Forest anomaly model (server/app/services/anomaly_model_service.py). */

export type AnomalyFeature = {
  feature: string;
  label: string;
};

export type AnomalyModelStatus = {
  /** ANOMALY_MODEL_ENABLED: risk assessments add the anomaly indicator */
  enabled: boolean;
  trained: boolean;
  model_name: string;
  model_version: string;
  features: AnomalyFeature[];
  indicator_code: string;
  indicator_weight: number;
  trained_at: string | null;
  training_rows: number | null;
  contamination: number | null;
  flagged_total: number | null;
  error: string | null;
};

export type FeatureDeviation = {
  feature: string;
  label: string;
  value: number | null;
  typical: number;
  robust_z: number | null;
};

export type FlaggedTransaction = {
  transaction_id: string;
  property_id: string | null;
  /** 0–1: share of registry transactions that are less unusual */
  anomaly_score: number;
  unusual_features: FeatureDeviation[];
  transaction_group: string | null;
  transaction_datetime: string | null;
  transaction_value: number | null;
  area_name: string | null;
};

export type FlaggedTransactions = {
  total: number;
  items: FlaggedTransaction[];
};

export type AnomalyScore = {
  transaction_id: string;
  model_name: string;
  model_version: string;
  anomaly_score: number;
  is_anomaly: boolean;
  contamination: number;
  unusual_features: FeatureDeviation[];
  profile: FeatureDeviation[];
};

export type AnomalyTrainResponse = {
  model_name: string;
  model_version: string;
  training_rows: number;
  contamination: number;
  flagged_total: number;
  trained_at: string;
};

/** Robust z-score a feature needs before it is called unusual (server EVIDENCE_Z). */
export const UNUSUAL_Z = 2;

export const CONTAMINATION_OPTIONS = [0.005, 0.01, 0.02, 0.05];

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatFeatureValue(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** "More unusual than N% of transactions", capped at 99 so it never claims 100. */
export function unusualPercentile(score: number) {
  return Math.min(99, Math.floor(score * 100));
}
