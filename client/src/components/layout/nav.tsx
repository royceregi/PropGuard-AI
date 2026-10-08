import type { AccessLevel } from "@/lib/auth/types";
import { homeForAccessLevel } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

export type NavItemId =
  | "dashboard"
  | "property_search"
  | "transactions"
  | "blockchain_verification"
  | "ai_investigation"
  | "risk_analysis"
  | "investigation_reports"
  | "audit_trail"
  | "shared_properties"
  | "users"
  | "settings";

export interface NavItem {
  id: NavItemId;
  href: string;
  label: string;
  badge: string | null;
  levels?: AccessLevel[];
}

export const navItems: NavItem[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    id: "property_search",
    href: "/property-search",
    label: "Property Search",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    id: "transactions",
    href: "/transactions",
    label: "Transactions",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    id: "blockchain_verification",
    href: "/blockchain-verification",
    label: "Blockchain Verification",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    id: "ai_investigation",
    href: "/ai-investigation",
    label: "AI Investigation",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    id: "risk_analysis",
    href: "/risk-analysis",
    label: "Risk Analysis",
    badge: null,
    levels: ["REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    id: "investigation_reports",
    href: "/investigation-reports",
    label: "Investigation Reports",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    id: "audit_trail",
    href: "/audit-trail",
    label: "Audit Trail",
    badge: null,
    levels: ["SYSTEM", "REGISTRY"]
  },
  {
    id: "shared_properties",
    href: "/shared-properties",
    label: "Shared Properties",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY", "PUBLIC"]
  },
  {
    id: "users",
    href: "/users",
    label: "User Management",
    badge: null,
    levels: ["SYSTEM", "REGISTRY", "COMPANY"]
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    badge: null,
    levels: ["SYSTEM"]
  }
];

export function visibleNavItems(
  accessLevel: AccessLevel | null | undefined
): NavItem[] {
  return navItems
    .filter((item) => {
      if (!item.levels || item.levels.length === 0) {
        return true;
      }
      return accessLevel ? item.levels.includes(accessLevel) : false;
    })
    .map((item) =>
      item.id === "dashboard" &&
      accessLevel &&
      isOperationalAccessLevel(accessLevel)
        ? { ...item, href: homeForAccessLevel(accessLevel) }
        : item
    );
}

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard")) {
    return "Dashboard";
  }

  if (pathname.startsWith("/profile")) {
    return "Profile";
  }

  if (pathname.startsWith("/notifications")) {
    return "Notifications";
  }

  if (pathname.startsWith("/property-search/")) {
    return "Property Details";
  }

  if (pathname.startsWith("/transactions/")) {
    return "Transaction Details";
  }

  if (pathname.startsWith("/shared-properties")) {
    return "Shared Properties";
  }

  const exact = navItems.find((item) => item.href === pathname);
  if (exact) {
    return exact.label;
  }

  const nested = navItems.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href)
  );

  return nested?.label ?? "Dashboard";
}

export function getNavItemBySlug(slug: string): NavItem | undefined {
  return navItems.find((item) => item.href === `/${slug}`);
}
