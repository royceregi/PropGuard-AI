"use client";

import type { ElementType, ReactNode } from "react";
import { Icons } from "@/components/icons";

export type StatsCardVariant = "default" | "highlight" | "error" | "info";

export interface StatsCardTrend {
  value: string;
  label: string;
  positive?: boolean;
  isError?: boolean;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ElementType;
  trend?: StatsCardTrend;
  variant?: StatsCardVariant;
  customFooter?: ReactNode;
  progress?: number;
  tag?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  customFooter,
  progress = 99.8,
  tag = "IMMUTABLE",
}: StatsCardProps) {
  const isHighlight = variant === "highlight";

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border p-4 shadow-[0_2px_4px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_16px_rgba(0,0,0,0.08)] ${
        isHighlight
          ? "border-surface-inverse/40 bg-black"
          : "border-border-subtle bg-surface"
      }`}
    >
      {isHighlight ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-secondary-300/20 blur-2xl transition-colors duration-500 group-hover:bg-secondary-300/30"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <p
          className={`text-xs font-semibold tracking-wider uppercase ${
            isHighlight ? "text-text-inverse/80" : "text-text-muted"
          }`}
        >
          {title}
        </p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${iconBadgeClass(variant)}`}
        >
          <Icon className="h-4 w-4 text-[16px]" />
        </span>
      </div>

      <p
        className={`relative mt-3 text-3xl font-bold tracking-tight ${
          isHighlight ? "text-text-inverse" : "text-text-primary"
        }`}
      >
        {value}
      </p>

      <div className="relative mt-3">
        {customFooter ?? (
          <DefaultFooter
            variant={variant}
            trend={trend}
            progress={progress}
            tag={tag}
          />
        )}
      </div>
    </article>
  );
}

function iconBadgeClass(variant: StatsCardVariant): string {
  switch (variant) {
    case "highlight":
      return "bg-white/10 text-secondary-300";
    case "error":
      return "bg-critical-container text-danger";
    case "info":
      return "bg-primary-subtle text-primary";
    default:
      return "bg-surface-subtle text-text-primary";
  }
}

function DefaultFooter({
  variant,
  trend,
  progress,
  tag,
}: {
  variant: StatsCardVariant;
  trend?: StatsCardTrend;
  progress: number;
  tag: string;
}) {
  if (variant === "highlight") {
    return (
      <div className="flex items-center gap-3">
        <div className="h-1 min-w-0 flex-1 rounded-full bg-white/20">
          <div
            className="h-1 rounded-full bg-primary-200 shadow-[0_0_8px_rgba(191,219,254,0.8)]"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-semibold tracking-widest text-text-inverse/80">
          {tag}
        </span>
      </div>
    );
  }

  if (!trend) {
    return null;
  }

  if (variant === "error" || trend.isError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-critical-container px-2 py-0.5 text-xs font-medium text-critical">
        <Icons.GppMaybe className="h-3.5 w-3.5 text-[14px]" />
        {trend.value}
        {trend.label ? ` / ${trend.label}` : null}
      </span>
    );
  }

  if (variant === "info") {
    return (
      <p className="text-xs text-text-muted">
        {trend.value ? `${trend.value} · ${trend.label}` : trend.label}
      </p>
    );
  }

  const tone = trend.positive === false ? "text-danger" : "text-success";

  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icons.TrendingUp
        className={`h-3.5 w-3.5 text-[14px] ${
          trend.positive === false ? "rotate-180" : ""
        }`}
      />
      <span>
        {trend.value} {trend.label}
      </span>
    </p>
  );
}
