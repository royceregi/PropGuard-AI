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

export interface PropertyTransaction {
  transaction_id: string;
  property_id: string | null;
  transaction_type_id: number | null;
  transaction_group: string | null;
  registration_type: string | null;
  procedure_name: string | null;
  transaction_datetime: string | null;
  transaction_value: string | number | null;
  previous_value: string | number | null;
  value_change_pct: string | number | null;
  procedure_area: string | number | null;
  meter_sale_price: string | number | null;
  currency: string | null;
  status: string | null;
  procedure_id: string | null;
  trans_group_id: string | null;
  area_id: string | null;
  area_name: string | null;
  project_number: string | null;
  project_name: string | null;
  master_project: string | null;
  nearest_landmark: string | null;
  rooms: string | null;
  has_parking: boolean | null;
  created_at: string | null;
  seller?: TransactionParty | null;
  buyer?: TransactionParty | null;
}

export interface PropertyTransactionDetail extends PropertyTransaction {
  parties: TransactionParty[];
  property: PropertySummary | null;
  current_owner: LinkedUserSummary | null;
  seller_matches_current_owner: boolean | null;
}

export interface PaginatedPropertyTransactions {
  items: PropertyTransaction[];
  total: number;
  skip: number;
  limit: number;
}

export interface TransactionSearchFilters {
  transactionId: string;
  propertyType: string;
  area: string;
  dateRange: string;
  projectName: string;
  minValue: string;
  maxValue: string;
  usage: string;
}

export const EMPTY_TRANSACTION_SEARCH_FILTERS: TransactionSearchFilters = {
  transactionId: "",
  propertyType: "",
  area: "",
  dateRange: "",
  projectName: "",
  minValue: "",
  maxValue: "",
  usage: ""
};

export const TRANSACTION_PAGE_SIZE = 12;

export function shortenId(value: string, head = 6, tail = 4): string {
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

export function formatMoneyWithCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined = "AED"
): string {
  const amount = formatMoney(value);
  if (amount === "—") {
    return amount;
  }
  return `${amount} ${currency?.trim() || "AED"}`;
}

export function formatTransactionDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function formatDateTimeFull(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function statusVariant(
  status: string | null | undefined
): "success" | "warning" | "error" | "neutral" | "info" {
  const normalized = (status ?? "").trim().toUpperCase();
  if (
    normalized === "COMPLETED" ||
    normalized === "VERIFIED" ||
    normalized === "APPROVED" ||
    normalized === "SUCCESS"
  ) {
    return "success";
  }
  if (
    normalized === "PENDING" ||
    normalized === "IN_PROGRESS" ||
    normalized === "SUBMITTED"
  ) {
    return "warning";
  }
  if (
    normalized === "FAILED" ||
    normalized === "REJECTED" ||
    normalized === "CANCELLED"
  ) {
    return "error";
  }
  return "neutral";
}

export function buildTransactionQueryParams(
  filters: TransactionSearchFilters,
  page: number,
  pageSize: number = TRANSACTION_PAGE_SIZE
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    skip: (page - 1) * pageSize,
    limit: pageSize
  };

  if (filters.transactionId.trim()) {
    params.transaction_id = filters.transactionId.trim();
  }
  if (filters.propertyType.trim()) {
    params.registration_type = filters.propertyType.trim();
  }
  if (filters.area.trim()) {
    params.area_name = filters.area.trim();
  }
  if (filters.projectName.trim()) {
    params.project_name = filters.projectName.trim();
  }
  if (filters.dateRange.trim()) {
    params.date_from = filters.dateRange.trim();
    params.date_to = filters.dateRange.trim();
  }
  if (filters.minValue.trim()) {
    params.min_value = filters.minValue.trim();
  }
  if (filters.maxValue.trim()) {
    params.max_value = filters.maxValue.trim();
  }

  return params;
}

export interface PropertySummary {
  property_id: string;
  property_name: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  land_area: string | number | null;
  area_unit: string | null;
  land_type: string | null;
  current_usage_type: string | null;
  current_subtype: string | null;
  verification_status: string | null;
  current_owner_id?: string | null;
  current_owner?: LinkedUserSummary | null;
}

export function partyDisplayName(
  party: TransactionParty | null | undefined
): string {
  if (!party) {
    return "—";
  }
  return (
    party.user?.full_name?.trim() ||
    party.party_name?.trim() ||
    party.user_id?.trim() ||
    "—"
  );
}
