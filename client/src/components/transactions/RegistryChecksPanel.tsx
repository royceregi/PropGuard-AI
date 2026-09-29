"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import {
  StatusBadge,
  type StatusBadgeVariant
} from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  CHECK_CATEGORY_LABELS,
  type CheckStatus,
  type RegistryCheck,
  type RegistryChecksResponse
} from "@/lib/blockchain/verification";

const STATUS_VARIANT: Record<CheckStatus, StatusBadgeVariant> = {
  PASS: "success",
  WARN: "warning",
  FAIL: "error",
  NA: "neutral"
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  PASS: "Pass",
  WARN: "Warning",
  FAIL: "Fail",
  NA: "N/A"
};

export function RegistryChecksPanel({
  transactionId
}: {
  transactionId: string;
}) {
  const [data, setData] = useState<RegistryChecksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RegistryChecksResponse>(
        `/api/v1/blockchain/checks/${encodeURIComponent(transactionId)}`
      )
      .then(({ data: result }) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(
            isAxiosError(err) && typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to run registry checks."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  const categories = data
    ? (Object.keys(CHECK_CATEGORY_LABELS) as RegistryCheck["category"][])
        .map((category) => ({
          category,
          checks: data.checks.filter((check) => check.category === category)
        }))
        .filter((group) => group.checks.length > 0)
    : [];

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
          <Icons.Gavel className="h-[22px] w-[22px] text-text-muted" />
          Registry Checks
        </h2>
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={`Overall: ${STATUS_LABEL[data.overall]}`}
              variant={STATUS_VARIANT[data.overall]}
              size="md"
            />
            <span className="text-xs text-text-muted">
              {data.counts.PASS} pass · {data.counts.WARN} warn ·{" "}
              {data.counts.FAIL} fail · {data.counts.NA} n/a
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : !data ? (
        <p className="text-sm text-text-muted">Running registry checks…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map(({ category, checks }) => (
            <div key={category}>
              <h3 className="mb-2 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                {CHECK_CATEGORY_LABELS[category]}
              </h3>
              <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {checks.map((check) => (
                  <CheckRow key={check.code} check={check} />
                ))}
              </ul>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            These checks test registry validity. They support investigation and
            do not by themselves establish fraud.
          </p>
        </div>
      )}
    </section>
  );
}

function CheckRow({ check }: { check: RegistryCheck }) {
  const showValues =
    check.status !== "PASS" &&
    (check.expected !== null || check.actual !== null);
  return (
    <li className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="w-24 shrink-0">
        <StatusBadge
          label={STATUS_LABEL[check.status]}
          variant={STATUS_VARIANT[check.status]}
          size="sm"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{check.name}</p>
        <p className="text-xs text-text-secondary">{check.reason}</p>
        {showValues ? (
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px] break-all">
            <dt className="text-text-muted">expected</dt>
            <dd className="text-text-primary">{check.expected ?? "—"}</dd>
            <dt className="text-text-muted">actual</dt>
            <dd className="text-text-primary">{check.actual ?? "—"}</dd>
          </dl>
        ) : null}
        {check.evidence.length > 0 ? (
          <p className="mt-1 text-[11px] text-text-muted">
            Evidence:{" "}
            {check.evidence
              .map((item) => `${item.table}${item.id ? ` #${item.id}` : ""}`)
              .join(", ")}
          </p>
        ) : null}
      </div>
    </li>
  );
}
