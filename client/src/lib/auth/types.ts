export const USER_ROLES = [
  "SUPER_ADMIN",
  "LAND_REGISTRY",
  "REAL_ESTATE_COMPANY",
  "PUBLIC_USER",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  user_id: string;
  full_name: string | null;
  nic: string;
  role: UserRole;
  wallet_address: string | null;
  username?: string | null;
  email?: string | null;
  kyc_status?: string | null;
  access_level?: string | null;
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

export function isUserRole(
  value: string | undefined | null,
): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}
