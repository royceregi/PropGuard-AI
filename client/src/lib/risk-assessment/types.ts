import type { StatusBadgeVariant } from "@/components/ui/StatusBadge";

export type RiskRequestStatus =
  "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type PropertyAccessType = "OWNER" | "SHARED";
export type SignalStatus = "PASS" | "WARN" | "FAIL" | "INFO";
export type RequesterAccessLevel = "PUBLIC" | "COMPANY";

export const VERIFICATION_SECTIONS = [
  "property_details",
  "title_records",
  "boundaries",
  "owner_details"
] as const;

export type VerificationSection = (typeof VERIFICATION_SECTIONS)[number];
export type VerificationChecks = Record<VerificationSection, boolean | null>;

export const SECTION_LABELS: Record<VerificationSection, string> = {
  property_details: "Property details",
  title_records: "Title records",
  boundaries: "Boundaries",
  owner_details: "Owner details"
};

export interface SnapshotDocument {
  document_id: number;
  document_type: string | null;
  document_number: string | null;
  document_hash: string | null;
  verification_status: string | null;
  issued_date: string | null;
}

export interface SnapshotOwnership {
  owner_id: string | null;
  owner_name: string | null;
  ownership_type: string | null;
  ownership_start_date: string | null;
  ownership_end_date: string | null;
  ownership_status: string | null;
}

export interface PropertySnapshot {
  property_id: string;
  property_name: string | null;
  title_deed_number: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  land_area: string | null;
  area_unit: string | null;
  land_type: string | null;
  survey_plan_number: string | null;
  current_usage_type: string | null;
  current_subtype: string | null;
  legal_status: string | null;
  verification_status: string | null;
  encumbrances: string | null;
  boundary_north: string | null;
  boundary_south: string | null;
  boundary_east: string | null;
  boundary_west: string | null;
  current_owner_id: string | null;
  current_owner_name: string | null;
  documents: SnapshotDocument[];
  ownership_history: SnapshotOwnership[];
}

export interface RiskSignal {
  code: string;
  label: string;
  status: SignalStatus;
  weight: number;
  detail: string;
}

export interface SystemChecks {
  signals: RiskSignal[];
  suggested_score: number;
  suggested_level: RiskLevel;
  evaluated_at: string;
}

export interface HistoryEvent {
  status: string;
  at: string;
  by: string | null;
  by_name: string | null;
  note: string | null;
}

export interface RiskRequestSummary {
  request_id: string;
  property_id: string;
  property_title: string | null;
  status: RiskRequestStatus;
  submitted_at: string;
  completed_at: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  requester: {
    user_id: string;
    full_name: string | null;
    access_level: RequesterAccessLevel | string;
  };
  is_own_request: boolean;
}

export interface RiskRequestDetail extends RiskRequestSummary {
  requester_notes: string | null;
  include_evidence: boolean;
  submitted_snapshot: PropertySnapshot;
  verification_checks: VerificationChecks;
  registry_notes: string | null;
  rejection_reason: string | null;
  system_signals: SystemChecks | null;
  result_hash: string | null;
  review_started_at: string | null;
  reviewer_name: string | null;
  history: HistoryEvent[];
  can_download_certificate: boolean;
}

export interface SnapshotChange {
  section: VerificationSection;
  field: string;
  submitted: unknown;
  current: unknown;
}

export interface RegistryWorkspace {
  request: RiskRequestDetail;
  current_property: PropertySnapshot | null;
  snapshot_changes: SnapshotChange[];
  system_checks: SystemChecks;
}

export interface PropertyAccessRow {
  property_id: string;
  property_title: string | null;
  location: string | null;
  access: PropertyAccessType;
  request: RiskRequestSummary | null;
  can_request: boolean;
}

export interface RequesterOverview {
  summary: {
    active_requests: number;
    completed_assessments: number;
    shared_with_me: number;
  };
  my_properties: PropertyAccessRow[];
  shared_with_me: PropertyAccessRow[];
}

export interface RegistryQueue {
  summary: {
    pending_intake: number;
    under_review: number;
    needs_clarification: number;
    completed_today: number;
  };
  items: RiskRequestSummary[];
  total: number;
}

export interface QueueFilters {
  status: RiskRequestStatus | "";
  requester_type: RequesterAccessLevel | "";
  submitted_from: string;
  submitted_to: string;
}

export const EMPTY_QUEUE_FILTERS: QueueFilters = {
  status: "",
  requester_type: "",
  submitted_from: "",
  submitted_to: ""
};

export const STATUS_LABELS: Record<RiskRequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected"
};

export const STATUS_VARIANTS: Record<RiskRequestStatus, StatusBadgeVariant> = {
  SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  VERIFIED: "success",
  REJECTED: "error"
};

export const LEVEL_VARIANTS: Record<RiskLevel, StatusBadgeVariant> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error"
};

export const SIGNAL_VARIANTS: Record<SignalStatus, StatusBadgeVariant> = {
  PASS: "success",
  WARN: "warning",
  FAIL: "error",
  INFO: "neutral"
};

export const REQUESTER_TYPE_LABELS: Record<string, string> = {
  PUBLIC: "Common User",
  COMPANY: "Real Estate"
};

export const SNAPSHOT_FIELD_LABELS: Record<string, string> = {
  property_id: "Property ID",
  property_name: "Property name",
  title_deed_number: "Title deed number",
  address: "Address",
  district: "District",
  city: "City",
  land_area: "Land area",
  area_unit: "Area unit",
  land_type: "Land type",
  survey_plan_number: "Survey plan number",
  current_usage_type: "Usage type",
  current_subtype: "Usage subtype",
  legal_status: "Legal status",
  verification_status: "Verification status",
  encumbrances: "Encumbrances",
  boundary_north: "North boundary",
  boundary_south: "South boundary",
  boundary_east: "East boundary",
  boundary_west: "West boundary",
  current_owner_id: "Owner ID",
  current_owner_name: "Owner name",
  documents: "Documents",
  ownership_history: "Ownership history"
};

/** Mirrors the backend band used to derive a level from the numeric score. */
export function levelForScore(score: number): RiskLevel {
  if (score <= 33) return "LOW";
  if (score <= 66) return "MEDIUM";
  return "HIGH";
}

export function requesterTypeLabel(level: string | null | undefined): string {
  return REQUESTER_TYPE_LABELS[(level ?? "").toUpperCase()] ?? (level || "—");
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text || "—";
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}
