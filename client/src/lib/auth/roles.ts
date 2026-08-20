import type { UserRole } from "@/lib/auth/types";

export const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN: "/dashboard/admin",
  LAND_REGISTRY: "/dashboard/registry",
  REAL_ESTATE_COMPANY: "/dashboard/company",
  PUBLIC_USER: "/dashboard/my-properties",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  LAND_REGISTRY: "Land Registry",
  REAL_ESTATE_COMPANY: "Real Estate Company",
  PUBLIC_USER: "Public User",
};

const AUTH_PAGES = new Set(["/login", "/forgot-password"]);
const PUBLIC_PAGES = new Set(["/", "/login", "/forgot-password"]);

const ROUTE_ACCESS: Array<{ prefix: string; roles: UserRole[] }> = [
  {
    prefix: "/dashboard/admin",
    roles: ["SUPER_ADMIN"],
  },
  {
    prefix: "/dashboard/registry",
    roles: ["SUPER_ADMIN", "LAND_REGISTRY"],
  },
  {
    prefix: "/dashboard/company",
    roles: ["SUPER_ADMIN", "REAL_ESTATE_COMPANY"],
  },
  {
    prefix: "/dashboard/my-properties",
    roles: ["SUPER_ADMIN", "PUBLIC_USER"],
  },
  {
    prefix: "/users",
    roles: ["SUPER_ADMIN"],
  },
  {
    prefix: "/audit-trail",
    roles: ["SUPER_ADMIN", "LAND_REGISTRY"],
  },
  {
    prefix: "/property-search",
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
  {
    prefix: "/ai-investigation",
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
  {
    prefix: "/risk-analysis",
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
];

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname);
}

export function canAccessPath(pathname: string, role: UserRole): boolean {
  const rule = ROUTE_ACCESS.find(
    (item) =>
      pathname === item.prefix || pathname.startsWith(`${item.prefix}/`),
  );
  if (!rule) {
    return true;
  }
  return rule.roles.includes(role);
}

export function homeForRole(role: UserRole): string {
  return ROLE_HOME[role];
}
