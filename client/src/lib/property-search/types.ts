export interface LinkedUserSummary {
  user_id: string;
  full_name: string | null;
  username: string | null;
  wallet_address: string | null;
  access_level: string | null;
}

export interface TransactionParty {
  transaction_party_id: number;
  transaction_id: string | null;
  user_id: string | null;
  party_name: string | null;
  role: string | null;
  is_primary: boolean | null;
  user: LinkedUserSummary | null;
}

export interface PropertyRecord {
  property_id: string;
  title_deed_number: string | null;
  property_name: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  land_area: string | number | null;
  area_unit: string | null;
  land_type: string | null;
  survey_plan_number?: string | null;
  current_owner_id: string | null;
  current_owner?: LinkedUserSummary | null;
  current_usage_type: string | null;
  current_subtype: string | null;
  current_value: string | number | null;
  legal_status: string | null;
  verification_status: string | null;
  encumbrances: string | null;
  boundary_north?: string | null;
  boundary_south?: string | null;
  boundary_east?: string | null;
  boundary_west?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PropertyDocument {
  document_id: number;
  property_id: string | null;
  transaction_id: string | null;
  document_type: string | null;
  document_number: string | null;
  document_text: string | null;
  document_hash: string | null;
  document_url: string | null;
  issued_date: string | null;
  verification_status: string | null;
  created_at: string | null;
}

export interface PropertyOwnershipHistory {
  ownership_id: number;
  property_id: string | null;
  owner_id: string | null;
  owner?: LinkedUserSummary | null;
  ownership_start_date: string | null;
  ownership_end_date: string | null;
  ownership_type: string | null;
  transaction_id: string | null;
  ownership_status: string | null;
  recorded_at: string | null;
}

export interface PropertyTransactionSummary {
  transaction_id: string;
  property_id: string | null;
  transaction_group: string | null;
  registration_type: string | null;
  procedure_name: string | null;
  transaction_datetime: string | null;
  transaction_value: string | number | null;
  currency: string | null;
  status: string | null;
  area_name: string | null;
  project_name: string | null;
  master_project: string | null;
  seller?: TransactionParty | null;
  buyer?: TransactionParty | null;
}

export interface PropertyDetail extends PropertyRecord {
  documents: PropertyDocument[];
  transactions: PropertyTransactionSummary[];
  ownership_history: PropertyOwnershipHistory[];
  documents_total: number;
  transactions_total: number;
  ownership_history_total: number;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface PaginatedProperties {
  items: PropertyRecord[];
  total: number;
  skip: number;
  limit: number;
}

export interface PropertySearchFilters {
  q: string;
  district: string;
  city: string;
  landType: string;
  usageType: string;
  verificationStatus: string;
  legalStatus: string;
}

export const EMPTY_PROPERTY_SEARCH_FILTERS: PropertySearchFilters = {
  q: "",
  district: "",
  city: "",
  landType: "",
  usageType: "",
  verificationStatus: "",
  legalStatus: ""
};

export const PROPERTY_PAGE_SIZE = 12;

export function shortenId(
  value: string | null | undefined,
  head = 6,
  tail = 4
): string {
  if (!value) {
    return "—";
  }
  if (value.length <= head + tail + 3) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const amount = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(amount)) {
    return String(value);
  }
  return amount.toLocaleString(undefined, {
    maximumFractionDigits: 0
  });
}

export function formatArea(
  value: string | number | null | undefined,
  unit: string | null | undefined
): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const amount = typeof value === "number" ? value : Number(value);
  const label = Number.isNaN(amount)
    ? String(value)
    : amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit?.trim() ? `${label} ${unit.trim()}` : label;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function propertyHref(propertyId: string): string {
  return `/property-search/${encodeURIComponent(propertyId)}`;
}

export { userProfileHref } from "@/lib/users/types";

export function statusVariant(
  status: string | null | undefined
): "success" | "warning" | "error" | "neutral" | "info" {
  const normalized = (status ?? "").trim().toUpperCase();
  if (
    normalized === "VERIFIED" ||
    normalized === "APPROVED" ||
    normalized === "ACTIVE" ||
    normalized === "CLEAR"
  ) {
    return "success";
  }
  if (
    normalized === "PENDING" ||
    normalized === "IN_REVIEW" ||
    normalized === "UNDER_REVIEW"
  ) {
    return "warning";
  }
  if (
    normalized === "REJECTED" ||
    normalized === "FAILED" ||
    normalized === "ENCUMBERED" ||
    normalized === "DISPUTED"
  ) {
    return "error";
  }
  return "neutral";
}

export function buildPropertyQueryParams(
  filters: PropertySearchFilters,
  page: number,
  pageSize: number = PROPERTY_PAGE_SIZE
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    skip: (page - 1) * pageSize,
    limit: pageSize
  };

  if (filters.q.trim()) {
    params.q = filters.q.trim();
  }
  if (filters.district.trim()) {
    params.district = filters.district.trim();
  }
  if (filters.city.trim()) {
    params.city = filters.city.trim();
  }
  if (filters.landType.trim()) {
    params.land_type = filters.landType.trim();
  }
  if (filters.usageType.trim()) {
    params.usage_type = filters.usageType.trim();
  }
  if (filters.verificationStatus.trim()) {
    params.verification_status = filters.verificationStatus.trim();
  }
  if (filters.legalStatus.trim()) {
    params.legal_status = filters.legalStatus.trim();
  }

  return params;
}
