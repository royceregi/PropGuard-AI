import type { AccessLevel } from "@/lib/auth/types";

export interface ManagedUser {
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone_number?: string | null;
  nic_hash: string | null;
  access_level: AccessLevel | string;
  wallet_address: string | null;
  kyc_status: string | null;
  mfa_enabled: boolean;
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function shortenWallet(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function shortenHash(value: string | null | undefined): string {
  if (!value?.trim()) {
    return "—";
  }
  const hash = value.trim();
  if (hash.length <= 14) {
    return hash;
  }
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function kycLabel(status: string | null | undefined): string {
  if (!status?.trim()) {
    return "Pending";
  }
  const normalized = status.trim().toUpperCase();
  if (normalized === "VERIFIED" || normalized === "APPROVED") {
    return "Approved";
  }
  if (
    normalized === "PENDING" ||
    normalized === "PENDING_APPROVAL" ||
    normalized === "SUBMITTED" ||
    normalized === "UNDER_REVIEW"
  ) {
    return "Pending";
  }
  if (normalized === "REJECTED") {
    return "Rejected";
  }
  if (normalized === "UNVERIFIED") {
    return "Unverified";
  }
  return status
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function kycVariant(
  status: string | null | undefined
): "success" | "warning" | "error" | "neutral" | "info" {
  const label = kycLabel(status);
  if (label === "Approved") {
    return "success";
  }
  if (label === "Pending") {
    return "warning";
  }
  if (label === "Rejected") {
    return "error";
  }
  return "neutral";
}

export function isPendingApproval(status: string | null | undefined): boolean {
  if (!status?.trim()) {
    return true;
  }
  const normalized = status.trim().toUpperCase();
  return (
    normalized === "PENDING" ||
    normalized === "PENDING_APPROVAL" ||
    normalized === "SUBMITTED" ||
    normalized === "UNDER_REVIEW"
  );
}

export const ASSIGNABLE_ACCESS_LEVELS = [
  "SYSTEM",
  "REGISTRY",
  "COMPANY",
  "PUBLIC",
  "STANDARD",
  "ELEVATED"
] as const;

/** Levels super admin may assign on public/end-user accounts. */
export const SYSTEM_END_USER_LEVELS = [
  "STANDARD",
  "PUBLIC",
  "ELEVATED"
] as const;

/** Levels registry/company may toggle between (regular ↔ pending). */
export const REGISTRY_COMPANY_TOGGLE_LEVELS = ["STANDARD", "ELEVATED"] as const;

export function isPendingAccessLevel(
  accessLevel: string | null | undefined
): boolean {
  return (accessLevel || "").trim().toUpperCase() === "ELEVATED";
}

export function isRegularEndUserLevel(
  accessLevel: string | null | undefined
): boolean {
  const level = (accessLevel || "").trim().toUpperCase();
  return level === "STANDARD" || level === "PUBLIC";
}

export interface UserRelatedProperty {
  property_id: string;
  property_name: string | null;
  title_deed_number: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  land_type: string | null;
  current_usage_type: string | null;
  verification_status: string | null;
  legal_status: string | null;
  encumbrances?: string | null;
  current_owner_id: string | null;
  is_current_owner: boolean;
  in_ownership_history: boolean;
  in_transactions: boolean;
  party_roles: string[];
}

export interface PaginatedUserRelatedProperties {
  items: UserRelatedProperty[];
  total: number;
  skip: number;
  limit: number;
}

/** Prefer username for profile URLs; fall back to user_id. */
export function userProfileHref(
  user:
    | {
        username?: string | null;
        user_id?: string | null;
      }
    | null
    | undefined,
  fallbackId?: string | null
): string | undefined {
  const username = user?.username?.trim();
  if (username) {
    return `/users/${encodeURIComponent(username)}`;
  }
  const userId = user?.user_id?.trim() || fallbackId?.trim();
  if (userId) {
    return `/users/${encodeURIComponent(userId)}`;
  }
  return undefined;
}
