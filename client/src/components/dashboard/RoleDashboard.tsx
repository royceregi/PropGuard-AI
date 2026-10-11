"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { StatsCard } from "@/components/stats/StatsCard";
import type { UserStats } from "@/components/users/UserManagementStats";
import {
  RequestStatusBadge,
  RiskLevelBadge
} from "@/components/risk-analysis/RiskShared";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import {
  formatDateTime,
  formatMoney,
  shortenId
} from "@/lib/property-search/types";
import {
  riskRequestHref,
  type RegistryQueue,
  type RequesterOverview,
  type RiskRequestSummary
} from "@/lib/risk-assessment/types";

type StaffLevel = "SYSTEM" | "REGISTRY" | "COMPANY";
type Icon = (typeof Icons)[keyof typeof Icons];

interface DashboardAnalytics {
  summary: {
    total_transactions: number;
    total_properties: number;
    high_risk_transactions: number;
    medium_risk_transactions: number;
    low_risk_transactions: number;
  };
  ledger_status: {
    confirmed: number;
    pending: number;
    failed: number;
    total: number;
    confirmed_pct: number;
  };
  risk_distribution: Record<
    "HIGH" | "MEDIUM" | "LOW",
    { count: number; pct: number }
  >;
  transactions_by_month: { period: string; count: number; avg_value: number }[];
  transactions_by_area: {
    area_name: string | null;
    count: number;
    avg_value: number;
  }[];
  recent_queries: {
    query_id: string;
    query_text: string | null;
    agent_used: string | null;
    flagged_suspicious: boolean | null;
    log_timestamp: string | null;
  }[];
}

interface RoleData {
  userStats?: UserStats;
  queue?: RegistryQueue;
  overview?: RequesterOverview;
}

const ROLE_COPY: Record<StaffLevel, { title: string; subtitle: string }> = {
  SYSTEM: {
    title: "System Overview",
    subtitle:
      "Platform health, ledger integrity, user approvals and recent AI activity."
  },
  REGISTRY: {
    title: "Land Registry Overview",
    subtitle:
      "Risk assessment requests waiting for review, alongside registry-wide activity."
  },
  COMPANY: {
    title: "Real Estate Overview",
    subtitle:
      "Your risk assessment requests and the market activity across the registry."
  }
};

interface QuickAction {
  label: string;
  href: string;
  icon: Icon;
}

const QUICK_ACTIONS: Record<StaffLevel, QuickAction[]> = {
  SYSTEM: [
    { label: "Manage users", href: "/users", icon: Icons.ManageAccounts },
    {
      label: "Verify ledger",
      href: "/blockchain-verification",
      icon: Icons.ViewInAr
    },
    {
      label: "AI investigation",
      href: "/ai-investigation",
      icon: Icons.AutoAwesome
    },
    { label: "Agent audit trail", href: "/audit-trail", icon: Icons.History }
  ],
  REGISTRY: [
    {
      label: "Review risk requests",
      href: "/risk-analysis",
      icon: Icons.GppMaybe
    },
    {
      label: "Search transactions",
      href: "/transactions",
      icon: Icons.Receipt
    },
    {
      label: "Verify ledger",
      href: "/blockchain-verification",
      icon: Icons.ViewInAr
    },
    {
      label: "AI investigation",
      href: "/ai-investigation",
      icon: Icons.AutoAwesome
    }
  ],
  COMPANY: [
    {
      label: "Request risk assessment",
      href: "/risk-analysis",
      icon: Icons.GppMaybe
    },
    {
      label: "Search properties",
      href: "/property-search",
      icon: Icons.Search
    },
    {
      label: "Search transactions",
      href: "/transactions",
      icon: Icons.Receipt
    },
    { label: "Shared properties", href: "/shared-properties", icon: Icons.Link }
  ]
};

const number = new Intl.NumberFormat("en-US");

function isStaffLevel(level: string | undefined): level is StaffLevel {
  return level === "SYSTEM" || level === "REGISTRY" || level === "COMPANY";
}

async function loadRoleData(level: StaffLevel): Promise<RoleData> {
  if (level === "SYSTEM") {
    const { data } = await api.get<UserStats>("/api/v1/users/stats");
    return { userStats: data };
  }
  if (level === "REGISTRY") {
    const { data } = await api.get<RegistryQueue>(
      "/api/v1/risk-assessments/queue",
      { params: { limit: 5 } }
    );
    return { queue: data };
  }
  const { data } = await api.get<RequesterOverview>(
    "/api/v1/risk-assessments/overview"
  );
  return { overview: data };
}

export function RoleDashboard() {
  const { user } = useAuth();
  const level = isStaffLevel(user?.access_level) ? user.access_level : null;
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [roleData, setRoleData] = useState<RoleData>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!level) return;
    let cancelled = false;
    Promise.allSettled([
      api.get<DashboardAnalytics>("/api/v1/analytics/dashboard"),
      loadRoleData(level)
    ]).then(([analyticsResult, roleResult]) => {
      if (cancelled) return;
      if (analyticsResult.status === "fulfilled") {
        setAnalytics(analyticsResult.value.data);
      } else {
        setError("Unable to load dashboard analytics.");
      }
      if (roleResult.status === "fulfilled") setRoleData(roleResult.value);
    });
    return () => {
      cancelled = true;
    };
  }, [level]);

  if (!level) return null;
  const copy = ROLE_COPY[level];
  const loading = !analytics && !error;

  return (
    <div className="space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {user?.full_name ? `Welcome back, ${user.full_name}. ` : null}
          {copy.subtitle}
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-critical-container px-4 py-3 text-sm text-critical">
          {error}
        </p>
      ) : null}

      <KpiGrid
        level={level}
        analytics={analytics}
        roleData={roleData}
        loading={loading}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <RolePanel level={level} roleData={roleData} analytics={analytics} />
          <MonthlyActivity rows={analytics?.transactions_by_month ?? []} />
        </div>
        <div className="space-y-6">
          <QuickActions actions={QUICK_ACTIONS[level]} />
          <RiskDistribution analytics={analytics} />
          <TopAreas rows={analytics?.transactions_by_area ?? []} />
        </div>
      </div>
    </div>
  );
}

function fmt(value: number | undefined, loading: boolean): string {
  if (value == null) return loading ? "…" : "—";
  return number.format(value);
}

function KpiGrid({
  level,
  analytics,
  roleData,
  loading
}: {
  level: StaffLevel;
  analytics: DashboardAnalytics | null;
  roleData: RoleData;
  loading: boolean;
}) {
  const ledger = analytics?.ledger_status;
  const summary = analytics?.summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatsCard
        title="Properties"
        value={fmt(summary?.total_properties, loading)}
        icon={Icons.LocationCity}
        variant="info"
        trend={{ value: "", label: "Registered in the land registry" }}
      />
      <StatsCard
        title="Transactions"
        value={fmt(summary?.total_transactions, loading)}
        icon={Icons.Receipt}
        variant="info"
        trend={{ value: "", label: "Recorded property transfers" }}
      />
      <StatsCard
        title="Ledger Confirmed"
        value={ledger ? `${ledger.confirmed_pct}%` : loading ? "…" : "—"}
        icon={Icons.ViewInAr}
        variant="highlight"
        progress={ledger?.confirmed_pct ?? 0}
        tag={ledger ? `${number.format(ledger.pending)} PENDING` : "LEDGER"}
      />
      <StatsCard
        title="High-Risk Assessments"
        value={fmt(summary?.high_risk_transactions, loading)}
        icon={Icons.GppBad}
        variant="error"
        trend={{
          value: fmt(summary?.medium_risk_transactions, loading),
          label: "medium risk"
        }}
      />
      <RoleKpi level={level} roleData={roleData} loading={loading} />
    </div>
  );
}

function RoleKpi({
  level,
  roleData,
  loading
}: {
  level: StaffLevel;
  roleData: RoleData;
  loading: boolean;
}) {
  if (level === "SYSTEM") {
    const stats = roleData.userStats;
    return (
      <StatsCard
        title="Pending Approvals"
        value={fmt(stats?.pending_approval, loading)}
        icon={Icons.HowToReg}
        trend={{
          value: fmt(stats?.total_users, loading),
          label: "users in total",
          positive: true
        }}
      />
    );
  }
  if (level === "REGISTRY") {
    const summary = roleData.queue?.summary;
    return (
      <StatsCard
        title="Pending Intake"
        value={fmt(summary?.pending_intake, loading)}
        icon={Icons.Mail}
        trend={{
          value: fmt(summary?.under_review, loading),
          label: "under review",
          positive: true
        }}
      />
    );
  }
  const summary = roleData.overview?.summary;
  return (
    <StatsCard
      title="Active Requests"
      value={fmt(summary?.active_requests, loading)}
      icon={Icons.HourglassEmpty}
      trend={{
        value: fmt(summary?.completed_assessments, loading),
        label: "completed",
        positive: true
      }}
    />
  );
}

function Panel({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-4 shadow-[0_2px_4px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wider text-text-muted uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
    >
      {label}
      <Icons.ArrowForward className="h-3.5 w-3.5 text-[14px]" />
    </Link>
  );
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-text-muted">{children}</p>;
}

function RolePanel({
  level,
  roleData,
  analytics
}: {
  level: StaffLevel;
  roleData: RoleData;
  analytics: DashboardAnalytics | null;
}) {
  if (level === "REGISTRY") {
    return (
      <Panel
        title="Latest Risk Requests"
        action={<PanelLink href="/risk-analysis" label="Open queue" />}
      >
        <RequestList
          requests={roleData.queue?.items ?? []}
          level={level}
          empty="No risk assessment requests are waiting."
        />
      </Panel>
    );
  }

  if (level === "COMPANY") {
    const rows = [
      ...(roleData.overview?.my_properties ?? []),
      ...(roleData.overview?.shared_with_me ?? [])
    ];
    const requests = rows
      .flatMap((row) => (row.request ? [row.request] : []))
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))
      .slice(0, 5);
    return (
      <Panel
        title="My Risk Requests"
        action={<PanelLink href="/risk-analysis" label="All requests" />}
      >
        <RequestList
          requests={requests}
          level={level}
          empty="You have not requested any risk assessments yet."
        />
      </Panel>
    );
  }

  const queries = analytics?.recent_queries ?? [];
  return (
    <Panel
      title="Recent AI Queries"
      action={<PanelLink href="/audit-trail" label="Audit trail" />}
    >
      {queries.length === 0 ? (
        <EmptyRow>No AI queries have been logged yet.</EmptyRow>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {queries.map((query) => (
            <li
              key={query.query_id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">
                  {query.query_text || "(empty query)"}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {query.agent_used ?? "assistant"} ·{" "}
                  {formatDateTime(query.log_timestamp)}
                </p>
              </div>
              {query.flagged_suspicious ? (
                <span className="shrink-0 rounded-full bg-critical-container px-2 py-0.5 text-xs font-medium text-critical">
                  Flagged
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RequestList({
  requests,
  level,
  empty
}: {
  requests: RiskRequestSummary[];
  level: StaffLevel;
  empty: string;
}) {
  if (requests.length === 0) return <EmptyRow>{empty}</EmptyRow>;
  return (
    <ul className="divide-y divide-border-subtle">
      {requests.map((request) => (
        <li key={request.request_id}>
          <Link
            href={riskRequestHref(request.request_id, level)}
            className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-surface-subtle/60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {request.property_title || shortenId(request.property_id)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {request.request_id} ·{" "}
                {level === "REGISTRY"
                  ? `${request.requester.full_name ?? "Requester"} · `
                  : null}
                {formatDateTime(request.submitted_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RiskLevelBadge level={request.risk_level} />
              <RequestStatusBadge status={request.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MonthlyActivity({
  rows
}: {
  rows: DashboardAnalytics["transactions_by_month"];
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Panel title="Monthly Transactions (latest 12 months on record)">
      {rows.length === 0 ? (
        <EmptyRow>No transaction history available.</EmptyRow>
      ) : (
        <div className="flex h-48 items-end gap-2">
          {rows.map((row) => (
            <div
              key={row.period}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${row.period}: ${number.format(row.count)} transactions, avg ${formatMoney(row.avg_value)}`}
            >
              <span className="text-[10px] text-text-muted">
                {number.format(row.count)}
              </span>
              <div
                className="w-full rounded-t-md bg-primary/80 transition-colors hover:bg-primary"
                style={{ height: `${(row.count / max) * 100}%` }}
              />
              <span className="truncate text-[10px] text-text-muted">
                {row.period.slice(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

const RISK_ROWS = [
  { key: "HIGH", label: "High", bar: "bg-danger" },
  { key: "MEDIUM", label: "Medium", bar: "bg-warning" },
  { key: "LOW", label: "Low", bar: "bg-success" }
] as const;

function RiskDistribution({
  analytics
}: {
  analytics: DashboardAnalytics | null;
}) {
  return (
    <Panel title="Risk Distribution">
      <div className="space-y-3">
        {RISK_ROWS.map(({ key, label, bar }) => {
          const entry = analytics?.risk_distribution[key];
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-text-primary">{label}</span>
                <span className="text-text-muted">
                  {entry
                    ? `${number.format(entry.count)} · ${entry.pct}%`
                    : "—"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-subtle">
                <div
                  className={`h-2 rounded-full ${bar}`}
                  style={{ width: `${entry?.pct ?? 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TopAreas({
  rows
}: {
  rows: DashboardAnalytics["transactions_by_area"];
}) {
  return (
    <Panel title="Most Active Areas">
      {rows.length === 0 ? (
        <EmptyRow>No area data available.</EmptyRow>
      ) : (
        <ol className="space-y-2">
          {rows.slice(0, 6).map((row, index) => (
            <li
              key={row.area_name ?? index}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 text-xs text-text-muted">{index + 1}</span>
                <span className="truncate text-text-primary">
                  {row.area_name ?? "Unknown area"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-text-muted">
                {number.format(row.count)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <Panel title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-start gap-2 rounded-lg border border-border-subtle p-3 text-sm font-medium text-text-primary transition-colors hover:border-primary hover:bg-primary-subtle"
          >
            <Icon className="h-5 w-5 text-[20px] text-primary" />
            {label}
          </Link>
        ))}
      </div>
    </Panel>
  );
}
