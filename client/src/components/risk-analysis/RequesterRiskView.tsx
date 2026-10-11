"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/components/icons";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  formatDate,
  formatDateTime,
  propertyHref,
  shortenId
} from "@/lib/property-search/types";
import {
  apiErrorMessage,
  isCompletedResult,
  SECTION_LABELS,
  VERIFICATION_SECTIONS,
  type PropertyAccessRow,
  type PropertySnapshot,
  type RequesterOverview,
  type RiskRequestDetail
} from "@/lib/risk-assessment/types";
import { toast } from "@/lib/toast";
import {
  downloadCertificate,
  HistoryTimeline,
  IssuesFoundNotice,
  RequestStatusBadge,
  RiskLevelBadge,
  SignalList,
  SnapshotSection,
  SummaryCard
} from "./RiskShared";

type Tab = "mine" | "shared";

export function RequesterRiskView() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<RequesterOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [stepperOpen, setStepperOpen] = useState(false);
  const [presetPropertyId, setPresetPropertyId] = useState<string | null>(null);
  const [resultRequestId, setResultRequestId] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<RequesterOverview>("/api/v1/risk-assessments/overview")
      .then(({ data }) => {
        if (!cancelled) {
          setOverview(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            apiErrorMessage(err, "Unable to load your risk assessments.")
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const queryPropertyId = searchParams.get("property_id")?.trim() || null;
  const [handledQuery, setHandledQuery] = useState<string | null>(null);
  if (overview && queryPropertyId && handledQuery !== queryPropertyId) {
    setHandledQuery(queryPropertyId);
    setPresetPropertyId(queryPropertyId);
    setStepperOpen(true);
  }

  const queryNew = searchParams.get("new");
  const [handledNew, setHandledNew] = useState<string | null>(null);
  if (overview && queryNew && handledNew !== queryNew && !queryPropertyId) {
    setHandledNew(queryNew);
    setPresetPropertyId(null);
    setStepperOpen(true);
  }

  const queryRequestId = searchParams.get("request")?.trim() || null;
  const [handledRequest, setHandledRequest] = useState<string | null>(null);
  if (queryRequestId && handledRequest !== queryRequestId) {
    setHandledRequest(queryRequestId);
    setResultRequestId(queryRequestId);
  }

  const allRows = useMemo(
    () => [
      ...(overview?.my_properties ?? []),
      ...(overview?.shared_with_me ?? [])
    ],
    [overview]
  );

  function openStepper(propertyId: string | null = null) {
    setPresetPropertyId(propertyId);
    setStepperOpen(true);
  }

  const rows =
    tab === "mine" ? overview?.my_properties : overview?.shared_with_me;

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Risk Assessments
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Request a Land Registry verified risk assessment for your own or
            shared properties. Official records are never changed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openStepper()}
          disabled={!overview || allRows.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icons.Add className="h-[18px] w-[18px]" />
          Request Risk Assessment
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Active Requests"
          value={overview?.summary.active_requests ?? "—"}
          icon={<Icons.HourglassEmpty />}
          tone="warning"
        />
        <SummaryCard
          label="Completed Assessments"
          value={overview?.summary.completed_assessments ?? "—"}
          icon={<Icons.GppGood />}
          tone="success"
        />
        <SummaryCard
          label="Shared With Me"
          value={overview?.summary.shared_with_me ?? "—"}
          icon={<Icons.Group />}
          tone="primary"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex gap-1 border-b border-border-subtle px-3 pt-2">
          {(
            [
              ["mine", "My Properties", overview?.my_properties.length],
              ["shared", "Shared with Me", overview?.shared_with_me.length]
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {label}
              {count != null ? (
                <span className="ml-1.5 text-xs text-text-muted">
                  ({count})
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="p-5 text-sm text-text-muted">Loading…</p>
        ) : error ? (
          <p role="alert" className="p-5 text-sm text-danger">
            {error}
          </p>
        ) : !rows || rows.length === 0 ? (
          <p className="p-5 text-sm text-text-muted">
            {tab === "mine"
              ? "You do not own any properties in the registry."
              : "No properties have been shared with you."}
          </p>
        ) : (
          <PropertyTable
            rows={rows}
            onRequest={openStepper}
            onView={setResultRequestId}
          />
        )}
      </section>

      <RequestStepper
        open={stepperOpen}
        rows={allRows}
        presetPropertyId={presetPropertyId}
        onClose={() => setStepperOpen(false)}
        onSubmitted={(detail) => {
          setStepperOpen(false);
          setReloadKey((key) => key + 1);
          setResultRequestId(detail.request_id);
        }}
      />

      <ResultDrawer
        requestId={resultRequestId}
        onClose={() => setResultRequestId(null)}
      />
    </div>
  );
}

function PropertyTable({
  rows,
  onRequest,
  onView
}: {
  rows: PropertyAccessRow[];
  onRequest: (propertyId: string) => void;
  onView: (requestId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
          <tr>
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3">Submission Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const req = row.request;
            return (
              <tr
                key={row.property_id}
                className="border-t border-border-subtle"
              >
                <td className="px-4 py-3">
                  <Link
                    href={propertyHref(row.property_id)}
                    className="font-medium text-link hover:text-link-hover"
                  >
                    {row.property_title || shortenId(row.property_id, 8, 6)}
                  </Link>
                  <p className="font-mono text-xs text-text-muted">
                    {shortenId(row.property_id, 10, 6)}
                  </p>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {req ? formatDate(req.submitted_at) : "—"}
                </td>
                <td className="px-4 py-3">
                  {req ? (
                    <div className="flex flex-col items-start gap-1">
                      <RequestStatusBadge status={req.status} />
                      {!req.is_own_request ? (
                        <span className="text-[11px] text-text-muted">
                          Requested by another user
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <StatusBadge
                      label="Not requested"
                      variant="neutral"
                      size="sm"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  <RiskLevelBadge
                    level={req?.risk_level ?? null}
                    score={req?.risk_score}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {req ? (
                      <button
                        type="button"
                        onClick={() => onView(req.request_id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary hover:bg-surface-subtle"
                      >
                        <Icons.Visibility className="h-4 w-4" />
                        {isCompletedResult(req.status)
                          ? "View Result"
                          : "Track Status"}
                      </button>
                    ) : null}
                    {row.can_request ? (
                      <button
                        type="button"
                        onClick={() => onRequest(row.property_id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-text-inverse hover:bg-primary-hover"
                      >
                        <Icons.Send className="h-4 w-4" />
                        {req ? "Request again" : "Request"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STEPS = [
  "Select Property",
  "Review Information",
  "Confirm & Submit"
] as const;

function RequestStepper({
  open,
  rows,
  presetPropertyId,
  onClose,
  onSubmitted
}: {
  open: boolean;
  rows: PropertyAccessRow[];
  presetPropertyId: string | null;
  onClose: () => void;
  onSubmitted: (detail: RiskRequestDetail) => void;
}) {
  const [step, setStep] = useState(0);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<PropertySnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(
    undefined
  );

  const openKey = open ? (presetPropertyId ?? "") : undefined;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (open) {
      const preset = rows.find((row) => row.property_id === presetPropertyId);
      const usable = preset && preset.can_request ? preset.property_id : null;
      setPropertyId(usable);
      setStep(usable ? 1 : 0);
      setSearch("");
      setSnapshot(null);
      setSnapshotError(
        presetPropertyId && !preset
          ? "That property is not yours or shared with you."
          : preset && !preset.can_request
            ? "You already have an active request for that property."
            : null
      );
      setNotes("");
      setIncludeEvidence(true);
      setConfirmed(false);
    }
  }

  useEffect(() => {
    if (
      !open ||
      step !== 1 ||
      !propertyId ||
      snapshot?.property_id === propertyId
    ) {
      return;
    }
    let cancelled = false;
    api
      .get<PropertySnapshot>(
        `/api/v1/risk-assessments/preview/${encodeURIComponent(propertyId)}`
      )
      .then(({ data }) => {
        if (!cancelled) {
          setSnapshot(data);
          setSnapshotError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSnapshotError(
            apiErrorMessage(err, "Unable to load property information.")
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, propertyId, snapshot?.property_id]);

  const filtered = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [row.property_id, row.property_title, row.location]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  async function submit() {
    if (!propertyId) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<RiskRequestDetail>(
        "/api/v1/risk-assessments/",
        {
          property_id: propertyId,
          notes: notes.trim() || null,
          include_evidence: includeEvidence
        }
      );
      toast.success(`Request ${data.request_id} sent to the Land Registry.`);
      onSubmitted(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unable to submit the request."));
    } finally {
      setSubmitting(false);
    }
  }

  const snapshotReady = snapshot?.property_id === propertyId;
  const canContinue =
    (step === 0 && Boolean(propertyId)) || (step === 1 && snapshotReady);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Risk Assessment"
      subtitle={
        <ol className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  index < step
                    ? "bg-success text-text-inverse"
                    : index === step
                      ? "bg-primary text-text-inverse"
                      : "bg-surface-muted text-text-muted"
                }`}
              >
                {index < step ? <Icons.Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className={
                  index === step
                    ? "font-semibold text-text-primary"
                    : "text-text-muted"
                }
              >
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <Icons.ChevronRight className="h-4 w-4 text-text-muted" />
              ) : null}
            </li>
          ))}
        </ol>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 2 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Continue
              <Icons.ArrowForward className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!confirmed || submitting}
              onClick={() => void submit()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icons.Send className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit to Land Registry"}
            </button>
          )}
        </div>
      }
    >
      {snapshotError && step !== 1 ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {snapshotError}
        </p>
      ) : null}

      {step === 0 ? (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by property ID, title, or location"
            className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
          />
          <ul className="max-h-80 divide-y divide-border-subtle overflow-y-auto rounded-lg border border-border-subtle">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-text-muted">
                No matching properties.
              </li>
            ) : (
              filtered.map((row) => (
                <li key={row.property_id}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2.5 ${
                      row.can_request
                        ? "cursor-pointer hover:bg-surface-subtle"
                        : "cursor-not-allowed opacity-60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="risk-property"
                      disabled={!row.can_request}
                      checked={propertyId === row.property_id}
                      onChange={() => {
                        setPropertyId(row.property_id);
                        setSnapshotError(null);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {row.property_title || row.property_id}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {row.location || "—"} ·{" "}
                        <span className="font-mono">
                          {shortenId(row.property_id, 8, 6)}
                        </span>
                      </p>
                    </div>
                    <StatusBadge
                      label={row.access === "OWNER" ? "Owner" : "Shared"}
                      variant={row.access === "OWNER" ? "info" : "neutral"}
                      size="sm"
                    />
                    {!row.can_request ? (
                      <span className="text-[11px] text-text-muted">
                        Active request
                      </span>
                    ) : null}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {step === 1 ? (
        snapshotError ? (
          <p role="alert" className="text-sm text-danger">
            {snapshotError}
          </p>
        ) : !snapshotReady ? (
          <p className="text-sm text-text-muted">
            Loading property information…
          </p>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">
              This registry information will be submitted with your request. If
              anything looks wrong, mention it in the notes on the next step.
            </p>
            {VERIFICATION_SECTIONS.map((section) => (
              <div key={section}>
                <h3 className="mb-3 text-sm font-semibold text-text-primary">
                  {SECTION_LABELS[section]}
                </h3>
                <SnapshotSection section={section} snapshot={snapshot!} />
              </div>
            ))}
          </div>
        )
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-3 text-sm">
            <p className="font-medium text-text-primary">
              {snapshot?.property_name ||
                snapshot?.title_deed_number ||
                propertyId}
            </p>
            <p className="font-mono text-xs text-text-muted">{propertyId}</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-text-primary">
              Notes for the registry (optional)
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Context for the assessment — e.g. pending purchase, boundary concerns…"
              className="w-full rounded-lg border border-border bg-surface-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(event) => setIncludeEvidence(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            Include the evidence report (blockchain integrity, encumbrances,
            legal status, and document checks) with the result.
          </label>
          <label className="flex items-start gap-3 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            I confirm I want the Land Registry to verify this property and
            assess its risk. I understand I cannot change the result.
          </label>
        </div>
      ) : null}
    </Modal>
  );
}

function ResultDrawer({
  requestId,
  onClose
}: {
  requestId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RiskRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    api
      .get<RiskRequestDetail>(
        `/api/v1/risk-assessments/${encodeURIComponent(requestId)}`
      )
      .then(({ data }) => {
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(apiErrorMessage(err, "Unable to load this assessment."));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const current = detail?.request_id === requestId ? detail : null;
  const snapshot = current?.submitted_snapshot;

  return (
    <Drawer
      open={Boolean(requestId)}
      onClose={onClose}
      title={
        current && isCompletedResult(current.status)
          ? "Assessment Result"
          : "Request Status"
      }
      subtitle={
        requestId ? (
          <span className="font-mono text-xs">{requestId}</span>
        ) : null
      }
      footer={
        current?.can_download_certificate ? (
          <button
            type="button"
            onClick={() => void downloadCertificate(current.request_id)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse hover:bg-primary-hover"
          >
            <Icons.FileDownload className="h-[18px] w-[18px]" />
            Download assessment certificate
          </button>
        ) : null
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : !current || !snapshot ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-base font-semibold text-text-primary">
              {current.property_title || current.property_id}
            </p>
            <p className="text-sm text-text-secondary">
              {[snapshot.address, snapshot.district, snapshot.city]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <RequestStatusBadge status={current.status} />
              <span className="text-xs text-text-muted">
                Submitted {formatDateTime(current.submitted_at)}
              </span>
            </div>
          </div>

          {isCompletedResult(current.status) ? (
            <div
              className={`space-y-4 rounded-xl border p-4 ${
                current.status === "ISSUES_FOUND"
                  ? "border-warning/40 bg-warning/5"
                  : "border-success/30 bg-success/5"
              }`}
            >
              {current.status === "ISSUES_FOUND" ? (
                <IssuesFoundNotice
                  checks={current.verification_checks}
                  audience="requester"
                />
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                    Official assessment
                  </p>
                  <div className="mt-1">
                    <RiskLevelBadge
                      level={current.risk_level}
                      score={current.risk_score}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                    {current.status === "ISSUES_FOUND"
                      ? "Registry reviewed"
                      : "Registry verified"}
                  </p>
                  <p className="text-sm font-medium text-text-primary">
                    {formatDateTime(current.completed_at)}
                  </p>
                  {current.reviewer_name ? (
                    <p className="text-xs text-text-muted">
                      {current.reviewer_name}
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                  Registry notes
                </p>
                <p className="text-sm whitespace-pre-line text-text-primary">
                  {current.registry_notes}
                </p>
              </div>
              {current.result_hash ? (
                <p className="font-mono text-[11px] break-all text-text-muted">
                  Result fingerprint: {current.result_hash}
                </p>
              ) : null}
            </div>
          ) : current.status === "REJECTED" ? (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
                Rejected by the Land Registry
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {current.rejection_reason}
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-border-subtle bg-surface-subtle p-4 text-sm text-text-secondary">
              {current.status === "SUBMITTED"
                ? "Your request is waiting for the Land Registry to pick it up."
                : "The Land Registry is reviewing the property information."}
            </p>
          )}

          {current.system_signals ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-text-primary">
                Evidence report
              </h3>
              <SignalList signals={current.system_signals.signals} />
            </div>
          ) : null}

          {current.history.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-text-primary">
                Status history
              </h3>
              <HistoryTimeline events={current.history} />
            </div>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
