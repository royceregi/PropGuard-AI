"use client";

import type { ReactNode } from "react";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  formatDate,
  formatDateTime,
  shortenId
} from "@/lib/property-search/types";
import {
  displayValue,
  LEVEL_VARIANTS,
  SIGNAL_VARIANTS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  type HistoryEvent,
  type PropertySnapshot,
  type RiskLevel,
  type RiskRequestStatus,
  type RiskSignal,
  type VerificationSection
} from "@/lib/risk-assessment/types";
import { toast } from "@/lib/toast";

export function RequestStatusBadge({ status }: { status: RiskRequestStatus }) {
  return (
    <StatusBadge
      label={STATUS_LABELS[status]}
      variant={STATUS_VARIANTS[status]}
      size="sm"
    />
  );
}

export function RiskLevelBadge({
  level,
  score
}: {
  level: RiskLevel | null;
  score?: number | null;
}) {
  if (!level) return <span className="text-sm text-text-muted">—</span>;
  return (
    <StatusBadge
      label={score != null ? `${level} · ${score}/100` : level}
      variant={LEVEL_VARIANTS[level]}
      size="sm"
    />
  );
}

export function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral"
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: "neutral" | "primary" | "warning" | "success" | "danger";
}) {
  const toneClass = {
    neutral: "text-text-muted",
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
    danger: "text-danger"
  }[tone];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
      <span className={`[&_svg]:h-6 [&_svg]:w-6 ${toneClass}`}>{icon}</span>
      <div>
        <p className="text-2xl font-bold text-text-primary tabular-nums">
          {value}
        </p>
        <p className="text-xs font-medium text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  mono = false,
  changed = false
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  changed?: boolean;
}) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
        {changed ? (
          <span className="ml-1.5 normal-case text-warning">· changed</span>
        ) : null}
      </span>
      <span
        className={`text-sm font-medium break-all text-text-primary ${mono ? "font-mono text-xs" : ""}`}
      >
        {displayValue(value)}
      </span>
    </div>
  );
}

function location(snapshot: PropertySnapshot): string {
  return (
    [snapshot.address, snapshot.district, snapshot.city]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ") || "—"
  );
}

export function SnapshotSection({
  section,
  snapshot,
  changedFields = new Set()
}: {
  section: VerificationSection;
  snapshot: PropertySnapshot;
  changedFields?: Set<string>;
}) {
  const changed = (field: string) => changedFields.has(field);

  if (section === "property_details") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Property name"
          value={snapshot.property_name}
          changed={changed("property_name")}
        />
        <Field
          label="Location"
          value={location(snapshot)}
          changed={changed("address") || changed("district") || changed("city")}
        />
        <Field
          label="Land area"
          value={
            snapshot.land_area
              ? `${snapshot.land_area} ${snapshot.area_unit ?? ""}`.trim()
              : null
          }
          changed={changed("land_area") || changed("area_unit")}
        />
        <Field
          label="Land type"
          value={snapshot.land_type}
          changed={changed("land_type")}
        />
        <Field
          label="Usage"
          value={[snapshot.current_usage_type, snapshot.current_subtype]
            .filter(Boolean)
            .join(" · ")}
          changed={changed("current_usage_type") || changed("current_subtype")}
        />
        <Field
          label="Legal status"
          value={snapshot.legal_status}
          changed={changed("legal_status")}
        />
        <Field
          label="Verification status"
          value={snapshot.verification_status}
          changed={changed("verification_status")}
        />
        <Field
          label="Encumbrances"
          value={snapshot.encumbrances}
          changed={changed("encumbrances")}
        />
      </div>
    );
  }

  if (section === "title_records") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Title deed number"
            value={snapshot.title_deed_number}
            mono
            changed={changed("title_deed_number")}
          />
          <Field
            label="Survey plan number"
            value={snapshot.survey_plan_number}
            mono
            changed={changed("survey_plan_number")}
          />
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Attachments ({snapshot.documents.length})
            {changed("documents") ? (
              <span className="ml-1.5 normal-case text-warning">· changed</span>
            ) : null}
          </p>
          {snapshot.documents.length === 0 ? (
            <p className="text-sm text-text-muted">No documents on file.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle">
              {snapshot.documents.map((doc) => (
                <li
                  key={doc.document_id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">
                      {doc.document_type ||
                        doc.document_number ||
                        `Document #${doc.document_id}`}
                    </p>
                    <p className="font-mono text-[11px] text-text-muted">
                      {doc.document_hash
                        ? shortenId(doc.document_hash, 8, 6)
                        : "No hash"}{" "}
                      · {formatDate(doc.issued_date)}
                    </p>
                  </div>
                  <StatusBadge
                    label={(doc.verification_status ?? "—").toUpperCase()}
                    variant="neutral"
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (section === "boundaries") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="North"
          value={snapshot.boundary_north}
          changed={changed("boundary_north")}
        />
        <Field
          label="South"
          value={snapshot.boundary_south}
          changed={changed("boundary_south")}
        />
        <Field
          label="East"
          value={snapshot.boundary_east}
          changed={changed("boundary_east")}
        />
        <Field
          label="West"
          value={snapshot.boundary_west}
          changed={changed("boundary_west")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Current owner"
          value={snapshot.current_owner_name}
          changed={changed("current_owner_name")}
        />
        <Field
          label="Owner ID"
          value={snapshot.current_owner_id}
          mono
          changed={changed("current_owner_id")}
        />
      </div>
      {snapshot.ownership_history.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
            Ownership history
            {changed("ownership_history") ? (
              <span className="ml-1.5 normal-case text-warning">· changed</span>
            ) : null}
          </p>
          <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {snapshot.ownership_history.map((row, index) => (
              <li
                key={`${row.owner_id}-${index}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-text-primary">
                  {row.owner_name || row.owner_id || "—"}
                </span>
                <span className="text-xs text-text-muted">
                  {formatDate(row.ownership_start_date)} –{" "}
                  {formatDate(row.ownership_end_date)} ·{" "}
                  {row.ownership_status || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function SignalList({ signals }: { signals: RiskSignal[] }) {
  return (
    <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
      {signals.map((signal) => (
        <li
          key={signal.code}
          className="flex items-start justify-between gap-3 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {signal.label}
            </p>
            <p className="text-xs text-text-secondary">{signal.detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {signal.weight > 0 ? (
              <span className="text-xs text-text-muted tabular-nums">
                +{signal.weight}
              </span>
            ) : null}
            <StatusBadge
              label={signal.status}
              variant={SIGNAL_VARIANTS[signal.status]}
              size="sm"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  return (
    <ol className="space-y-3">
      {events.map((event, index) => (
        <li key={`${event.status}-${index}`} className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {STATUS_LABELS[event.status as RiskRequestStatus] ?? event.status}
              <span className="ml-2 text-xs font-normal text-text-muted">
                {formatDateTime(event.at)}
                {event.by_name ? ` · ${event.by_name}` : ""}
              </span>
            </p>
            {event.note ? (
              <p className="text-xs text-text-secondary">{event.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export async function downloadCertificate(requestId: string) {
  try {
    const { data } = await api.get<Blob>(
      `/api/v1/risk-assessments/${encodeURIComponent(requestId)}/certificate`,
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `risk-assessment-${requestId}.html`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Unable to download the assessment certificate.");
  }
}

export function RestrictedState() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 p-10 text-center">
      <Icons.Lock className="h-10 w-10 text-text-muted" />
      <p className="text-xs font-semibold tracking-widest text-text-muted uppercase">
        403 Forbidden
      </p>
      <h1 className="text-xl font-bold text-text-primary">
        Feature not enabled for Super Admin
      </h1>
      <p className="text-sm text-text-secondary">
        Risk assessments are requested by Common and Real Estate users and
        processed by the Land Registry.
      </p>
    </div>
  );
}
