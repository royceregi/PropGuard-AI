export const ACCESS_LEVELS = [
  "SYSTEM",
  "REGISTRY",
  "COMPANY",
  "PUBLIC",
  "STANDARD",
  "ELEVATED",
] as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Operational levels that may sign in (must also be is_active). */
export const OPERATIONAL_ACCESS_LEVELS = [
  "SYSTEM",
  "REGISTRY",
  "COMPANY",
  "PUBLIC",
] as const;

export type OperationalAccessLevel = (typeof OPERATIONAL_ACCESS_LEVELS)[number];

/** @deprecated Use AccessLevel — kept as alias during migration. */
export type UserRole = AccessLevel;

export interface AuthUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
  access_level: AccessLevel;
  wallet_address: string | null;
  username?: string | null;
  nic_hash?: string | null;
  kyc_status?: string | null;
  mfa_enabled?: boolean;
  is_active?: boolean;
  last_login?: string | null;
  permissions?: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export function isAccessLevel(
  value: string | undefined | null,
): value is AccessLevel {
  return ACCESS_LEVELS.includes(value as AccessLevel);
}

export function isOperationalAccessLevel(
  value: string | undefined | null,
): value is OperationalAccessLevel {
  return OPERATIONAL_ACCESS_LEVELS.includes(value as OperationalAccessLevel);
}

/** @deprecated Use isAccessLevel / isOperationalAccessLevel. */
export function isUserRole(
  value: string | undefined | null,
): value is AccessLevel {
  return isOperationalAccessLevel(value) || isAccessLevel(value);
}
