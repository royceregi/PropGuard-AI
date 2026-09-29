import type { ReactNode } from "react";

export type StatusBadgeVariant =
  "success" | "info" | "warning" | "error" | "neutral";

export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  icon?: ReactNode;
  size?: StatusBadgeSize;
  className?: string;
}

const variantClass: Record<StatusBadgeVariant, string> = {
  success: "border-success/30 bg-success-container text-success-hover",
  info: "border-primary-subtle-alt bg-primary-subtle text-primary",
  warning: "border-accent-container-alt bg-accent-container text-accent",
  error: "border-danger/40 bg-critical-container text-critical",
  neutral: "border-border-subtle bg-surface-subtle text-text-secondary"
};

const sizeClass: Record<StatusBadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-xs"
};

export function StatusBadge({
  label,
  variant = "info",
  icon,
  size = "md",
  className
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantClass[variant]} ${sizeClass[size]} ${className ?? ""}`}
    >
      {icon ? (
        <span className="mr-1.5 inline-flex [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
      ) : null}
      {label}
    </span>
  );
}
