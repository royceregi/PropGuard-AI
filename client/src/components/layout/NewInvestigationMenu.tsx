"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import type { OperationalAccessLevel } from "@/lib/auth/types";

type Icon = (typeof Icons)[keyof typeof Icons];

interface MenuAction {
  label: string;
  description: string;
  icon: Icon;
  href: () => string;
}

const REQUEST_RISK: MenuAction = {
  label: "Request Risk Assessment",
  description: "Ask the Land Registry to verify a property",
  icon: Icons.GppMaybe,
  // A fresh value re-opens the request form even when already on the page.
  href: () => `/risk-analysis?new=${Date.now()}`
};
const AI_INVESTIGATION: MenuAction = {
  label: "AI Investigation",
  description: "Run the agents on a transaction or question",
  icon: Icons.AutoAwesome,
  href: () => "/ai-investigation"
};
const VERIFY_LEDGER: MenuAction = {
  label: "Blockchain Verification",
  description: "Check a transaction against the ledger",
  icon: Icons.ViewInAr,
  href: () => "/blockchain-verification"
};
const SEARCH_TRANSACTIONS: MenuAction = {
  label: "Search Transactions",
  description: "Filter and inspect property transactions",
  icon: Icons.Receipt,
  href: () => "/transactions"
};
const SEARCH_PROPERTIES: MenuAction = {
  label: "Search Properties",
  description: "Find a property you own or that is shared with you",
  icon: Icons.Search,
  href: () => "/property-search"
};

const ACTIONS: Record<OperationalAccessLevel, MenuAction[]> = {
  SYSTEM: [
    AI_INVESTIGATION,
    VERIFY_LEDGER,
    SEARCH_TRANSACTIONS,
    {
      label: "Agent Audit Trail",
      description: "Review past AI agent runs",
      icon: Icons.History,
      href: () => "/audit-trail"
    }
  ],
  REGISTRY: [
    {
      label: "Review Risk Requests",
      description: "Open the risk assessment request queue",
      icon: Icons.GppMaybe,
      href: () => "/risk-analysis"
    },
    AI_INVESTIGATION,
    VERIFY_LEDGER,
    SEARCH_TRANSACTIONS
  ],
  COMPANY: [REQUEST_RISK, AI_INVESTIGATION, VERIFY_LEDGER, SEARCH_TRANSACTIONS],
  PUBLIC: [REQUEST_RISK, SEARCH_PROPERTIES]
};

export function NewInvestigationMenu({
  accessLevel
}: {
  accessLevel: OperationalAccessLevel;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = ACTIONS[accessLevel];
  const label =
    accessLevel === "PUBLIC" ? "New Request" : "Start New Investigation";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg bg-primary p-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover sm:px-3 lg:px-4 lg:py-2"
      >
        <Icons.Add className="h-5 w-5 text-[20px]" />
        <span className="hidden lg:inline">{label}</span>
        <Icons.KeyboardArrowDown className="hidden h-4 w-4 lg:inline" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border-subtle bg-surface py-1.5 shadow-lg"
        >
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push(action.href());
                }}
                className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-subtle"
              >
                <ActionIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">
                    {action.label}
                  </span>
                  <span className="block text-xs text-text-muted">
                    {action.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
