import { homeForRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";

export type NavItemId =
  | "dashboard"
  | "property_search"
  | "transactions"
  | "blockchain_verification"
  | "ai_investigation"
  | "risk_analysis"
  | "investigation_reports"
  | "audit_trail"
  | "users"
  | "settings";

export interface NavItem {
  id: NavItemId;
  href: string;
  label: string;
  badge: string | null;
  roles?: UserRole[];
}

export const navItems: NavItem[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    badge: null,
  },
  {
    id: "property_search",
    href: "/property-search",
    label: "Property Search",
    badge: null,
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
  {
    id: "transactions",
    href: "/transactions",
    label: "Transactions",
    badge: null,
  },
  {
    id: "blockchain_verification",
    href: "/blockchain-verification",
    label: "Blockchain Verification",
    badge: null,
  },
  {
    id: "ai_investigation",
    href: "/ai-investigation",
    label: "AI Investigation",
    badge: null,
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
  {
    id: "risk_analysis",
    href: "/risk-analysis",
    label: "Risk Analysis",
    badge: null,
    roles: ["SUPER_ADMIN", "LAND_REGISTRY", "REAL_ESTATE_COMPANY"],
  },
  {
    id: "investigation_reports",
    href: "/investigation-reports",
    label: "Investigation Reports",
    badge: null,
  },
  {
    id: "audit_trail",
    href: "/audit-trail",
    label: "Audit Trail",
    badge: null,
    roles: ["SUPER_ADMIN", "LAND_REGISTRY"],
  },
  {
    id: "users",
    href: "/users",
    label: "Users",
    badge: null,
    roles: ["SUPER_ADMIN"],
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    badge: null,
  },
];

export function visibleNavItems(role: UserRole | null | undefined): NavItem[] {
  return navItems
    .filter((item) => {
      if (!item.roles || item.roles.length === 0) {
        return true;
      }
      return role ? item.roles.includes(role) : false;
    })
    .map((item) =>
      item.id === "dashboard" && role
        ? { ...item, href: homeForRole(role) }
        : item,
    );
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) {
    return "Dashboard";
  }

  const exact = navItems.find((item) => item.href === pathname);
  if (exact) {
    return exact.label;
  }

  const nested = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href),
  );

  return nested?.label ?? "Dashboard";
}

export function getNavItemBySlug(slug: string): NavItem | undefined {
  return navItems.find((item) => item.href === `/${slug}`);
}
