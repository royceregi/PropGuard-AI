import type { AccessLevel, OperationalAccessLevel } from "@/lib/auth/types";

export const ACCESS_HOME: Record<OperationalAccessLevel, string> = {
  SYSTEM: "/dashboard/admin",
  REGISTRY: "/dashboard/registry",
  COMPANY: "/dashboard/company",
  PUBLIC: "/dashboard/my-properties"
};

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  SYSTEM: "Super Admin",
  REGISTRY: "Land Registry",
  COMPANY: "Real Estate Company",
  PUBLIC: "Public User",
  STANDARD: "Standard",
  ELEVATED: "Pending"
};

/** @deprecated Use ACCESS_HOME / ACCESS_LABELS. */
export const ROLE_HOME = ACCESS_HOME;
export const ROLE_LABELS = ACCESS_LABELS;

const AUTH_PAGES = new Set(["/login", "/forgot-password"]);
const PUBLIC_PAGES = new Set(["/", "/login", "/forgot-password"]);

const ROUTE_ACCESS: Array<{
  prefix: string;
  levels: OperationalAccessLevel[];
}> = [
  {
    prefix: "/dashboard/admin",
    levels: ["SYSTEM"]
  },
  {
    prefix: "/dashboard/registry",
    levels: ["SYSTEM", "REGISTRY"]
  },
  {
    prefix: "/dashboard/company",
    levels: ["SYSTEM", "COMPANY"]
  },
  {
    prefix: "/dashboard/my-properties",
    levels: ["SYSTEM", "PUBLIC"]
  },
  {
    prefix: "/profile",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/users",
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    prefix: "/audit-trail",
    levels: ["SYSTEM", "REGISTRY"]
  },
  {
    prefix: "/property-search",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/transactions",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/blockchain-verification",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/ai-investigation",
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    prefix: "/risk-analysis",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/investigation-reports",
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    prefix: "/settings",
    levels: ["SYSTEM"]
  }
];

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname);
}

export function canAccessPath(
  pathname: string,
  accessLevel: OperationalAccessLevel
): boolean {
  const rule = ROUTE_ACCESS.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );
  if (!rule) {
    return true;
  }
  return rule.levels.includes(accessLevel);
}

export function homeForAccessLevel(
  accessLevel: OperationalAccessLevel
): string {
  return ACCESS_HOME[accessLevel];
}

/** @deprecated Use homeForAccessLevel. */
export function homeForRole(accessLevel: OperationalAccessLevel): string {
  return homeForAccessLevel(accessLevel);
}

export function labelForAccessLevel(
  accessLevel: string | null | undefined
): string {
  if (!accessLevel?.trim()) {
    return "—";
  }
  const key = accessLevel.trim().toUpperCase() as AccessLevel;
  return ACCESS_LABELS[key] ?? accessLevel;
}
