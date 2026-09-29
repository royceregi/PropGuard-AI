"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { formatDateTime, propertyHref } from "@/lib/property-search/types";
import {
  apiErrorMessage,
  displayValue,
  levelForScore,
  requesterTypeLabel,
  SECTION_LABELS,
  SNAPSHOT_FIELD_LABELS,
  VERIFICATION_SECTIONS,
  type RegistryWorkspace,
  type RiskRequestDetail,
  type VerificationChecks,
  type VerificationSection
} from "@/lib/risk-assessment/types";
import { toast } from "@/lib/toast";
import {
  downloadCertificate,
  HistoryTimeline,
  RequestStatusBadge,
  RestrictedState,
  RiskLevelBadge,
  SignalList,
  SnapshotSection
} from "./RiskShared";

const EMPTY_CHECKS: VerificationChecks = {
  property_details: null,
  title_records: null,
  boundaries: null,
  owner_details: null
};

type Busy = "start" | "draft" | "verify" | "reject" | null;

export function RegistryReviewWorkspace({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<RegistryWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<VerificationChecks>(EMPTY_CHECKS);
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [dirty, setDirty] = useState(false);

  const applyRequest = useCallback((request: RiskRequestDetail) => {
    setWorkspace((current) => (current ? { ...current, request } : current));
    setChecks({ ...EMPTY_CHECKS, ...request.verification_checks });
    setScore(request.risk_score != null ? String(request.risk_score) : "");
    setNotes(request.registry_notes ?? "");
    setDirty(false);
  }, []);

  const applyWorkspace = useCallback((data: RegistryWorkspace) => {
    setWorkspace(data);
    setChecks({ ...EMPTY_CHECKS, ...data.request.verification_checks });
    setScore(
      data.request.risk_score != null ? String(data.request.risk_score) : ""
    );
    setNotes(data.request.registry_notes ?? "");
    setDirty(false);
  }, []);

  useEffect(() => {
    if (user?.access_level !== "REGISTRY") return;
    let cancelled = false;
    api
      .get<RegistryWorkspace>(
        `/api/v1/risk-assessments/${encodeURIComponent(requestId)}/workspace`
      )
      .then(({ data }) => {
        if (!cancelled) applyWorkspace(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(apiErrorMessage(err, "Unable to load this request."));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, user?.access_level, applyWorkspace]);

  const changedBySection = useMemo(() => {
    const map: Record<VerificationSection, Set<string>> = {
      property_details: new Set(),
      title_records: new Set(),
      boundaries: new Set(),
      owner_details: new Set()
    };
    for (const change of workspace?.snapshot_changes ?? []) {
      map[change.section]?.add(change.field);
    }
    return map;
  }, [workspace?.snapshot_changes]);

  if (user && user.access_level === "SYSTEM") return <RestrictedState />;
  if (user && user.access_level !== "REGISTRY") {
    return (
      <p className="text-sm text-danger">
        Only the Land Registry can process risk assessment requests.
      </p>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      </div>
    );
  }
  if (!workspace)
    return <p className="text-sm text-text-muted">Loading request…</p>;

  const request = workspace.request;
  const snapshot = request.submitted_snapshot;
  const system = workspace.system_checks;
  const editable = request.status === "UNDER_REVIEW";
  const finished =
    request.status === "VERIFIED" || request.status === "REJECTED";
  const scoreNumber = score.trim() === "" ? null : Number(score);
  const scoreValid =
    scoreNumber != null &&
    Number.isInteger(scoreNumber) &&
    scoreNumber >= 0 &&
    scoreNumber <= 100;
  const allVerified = VERIFICATION_SECTIONS.every(
    (section) => checks[section] === true
  );
  const canVerify =
    editable && allVerified && scoreValid && notes.trim().length > 0;

  async function run<T>(kind: Busy, action: () => Promise<T>, success: string) {
    setBusy(kind);
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(apiErrorMessage(err, "The action could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  const base = `/api/v1/risk-assessments/${encodeURIComponent(request.request_id)}`;

  const startReview = () =>
    run(
      "start",
      async () => {
        const { data } = await api.post<RegistryWorkspace>(
          `${base}/start-review`
        );
        applyWorkspace(data);
      },
      "Review started. The requester now sees the request as under review."
    );

  const saveDraft = () =>
    run(
      "draft",
      async () => {
        const { data } = await api.patch<RiskRequestDetail>(`${base}/draft`, {
          verification_checks: checks,
          risk_score: scoreValid ? scoreNumber : null,
          registry_notes: notes
        });
        applyRequest(data);
      },
      "Draft saved."
    );

  const verifyAndSend = () =>
    run(
      "verify",
      async () => {
        const { data } = await api.post<RiskRequestDetail>(`${base}/verify`, {
          verification_checks: checks,
          risk_score: scoreNumber,
          registry_notes: notes
        });
        applyRequest(data);
      },
      "Assessment verified and sent to the requester."
    );

  const reject = () =>
    run(
      "reject",
      async () => {
        const { data } = await api.post<RiskRequestDetail>(`${base}/reject`, {
          reason: rejectReason
        });
        applyRequest(data);
        setRejecting(false);
      },
      "Request rejected. The requester has been informed."
    );

  const setCheck = (section: VerificationSection, value: boolean | null) => {
    setChecks((current) => ({ ...current, [section]: value }));
    setDirty(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Risk Assessment Requests", href: "/risk-analysis" },
            { label: request.request_id }
          ]}
          className="mb-4"
        />
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              {request.property_title || request.property_id}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <RequestStatusBadge status={request.status} />
              <StatusBadge
                label={requesterTypeLabel(request.requester.access_level)}
                variant={
                  request.requester.access_level === "COMPANY"
                    ? "info"
                    : "neutral"
                }
                size="sm"
              />
              <span>
                Requested by{" "}
                {request.requester.full_name || request.requester.user_id} ·{" "}
                {formatDateTime(request.submitted_at)}
              </span>
            </div>
          </div>
          <Link
            href={propertyHref(request.property_id)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-subtle"
          >
            <Icons.OpenInNew className="h-[18px] w-[18px]" />
            Open property record
          </Link>
        </div>
      </div>

      {request.status === "SUBMITTED" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-primary-subtle-alt bg-primary-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-primary">
            This request is waiting for intake. Start the review to verify the
            property information and record the assessment.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-danger hover:bg-surface-subtle"
            >
              Reject Request
            </button>
            <button
              type="button"
              onClick={() => void startReview()}
              disabled={busy !== null}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse hover:bg-primary-hover disabled:opacity-60"
            >
              <Icons.FindInPage className="h-[18px] w-[18px]" />
              {busy === "start" ? "Starting…" : "Start Review"}
            </button>
          </div>
        </div>
      ) : null}

      {workspace.snapshot_changes.length > 0 ? (
        <div className="rounded-xl border border-accent-container-alt bg-accent-container p-4 text-sm">
          <p className="font-medium text-accent-text">
            The registry record changed after this request was submitted.
          </p>
          <ul className="mt-2 space-y-1 text-text-secondary">
            {workspace.snapshot_changes.map((change) => (
              <li key={`${change.section}-${change.field}`}>
                <span className="font-medium text-text-primary">
                  {SNAPSHOT_FIELD_LABELS[change.field] ?? change.field}:
                </span>{" "}
                {displayValue(change.submitted)} →{" "}
                {displayValue(change.current)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-4 xl:col-span-3">
          <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">
            Property verification
          </h2>
          {VERIFICATION_SECTIONS.map((section) => (
            <section
              key={section}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-text-primary">
                  {SECTION_LABELS[section]}
                </h3>
                <SectionToggle
                  value={checks[section]}
                  disabled={!editable}
                  onChange={(value) => setCheck(section, value)}
                />
              </div>
              <SnapshotSection
                section={section}
                snapshot={snapshot}
                changedFields={changedBySection[section]}
              />
            </section>
          ))}
        </div>

        <div className="flex flex-col gap-4 xl:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">
            Risk assessment
          </h2>

          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-text-primary">
                System checks
              </h3>
              <RiskLevelBadge
                level={system.suggested_level}
                score={system.suggested_score}
              />
            </div>
            <SignalList signals={system.signals} />
            <p className="mt-2 text-xs text-text-muted">
              Suggested score is the sum of flagged signal weights. Evaluated{" "}
              {formatDateTime(system.evaluated_at)}.
            </p>
          </section>

          {request.requester_notes ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-2 text-base font-bold text-text-primary">
                Requester notes
              </h3>
              <p className="text-sm whitespace-pre-line text-text-secondary">
                {request.requester_notes}
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-4 text-base font-bold text-text-primary">
              Registry evaluation
            </h3>
            {finished ? (
              <div className="space-y-3">
                {request.status === "VERIFIED" ? (
                  <>
                    <RiskLevelBadge
                      level={request.risk_level}
                      score={request.risk_score}
                    />
                    <p className="text-sm whitespace-pre-line text-text-primary">
                      {request.registry_notes}
                    </p>
                    <p className="text-xs text-text-muted">
                      Sent to requester {formatDateTime(request.completed_at)}
                      {request.reviewer_name
                        ? ` by ${request.reviewer_name}`
                        : ""}
                    </p>
                    {request.result_hash ? (
                      <p className="font-mono text-[11px] break-all text-text-muted">
                        Result fingerprint: {request.result_hash}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        void downloadCertificate(request.request_id)
                      }
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-subtle"
                    >
                      <Icons.FileDownload className="h-4 w-4" />
                      Download certificate
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-danger">Rejected</p>
                    <p className="text-sm text-text-primary">
                      {request.rejection_reason}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-sm font-medium text-text-primary">
                    Risk score (0–100)
                    {scoreValid ? (
                      <RiskLevelBadge level={levelForScore(scoreNumber!)} />
                    ) : null}
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={scoreValid ? scoreNumber! : 0}
                      disabled={!editable}
                      onChange={(event) => {
                        setScore(event.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 accent-[var(--color-primary)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={score}
                      disabled={!editable}
                      onChange={(event) => {
                        setScore(event.target.value);
                        setDirty(true);
                      }}
                      className="h-10 w-20 rounded-lg border border-border bg-surface-canvas px-2 text-sm text-text-primary outline-none focus:border-primary disabled:opacity-60"
                    />
                  </div>
                  <span className="flex items-center justify-between text-xs text-text-muted">
                    Low 0–33 · Medium 34–66 · High 67–100
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setScore(String(system.suggested_score));
                          setDirty(true);
                        }}
                        className="font-medium text-link hover:text-link-hover"
                      >
                        Use suggested ({system.suggested_score})
                      </button>
                    ) : null}
                  </span>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-text-primary">
                    Official evaluation notes & findings
                  </span>
                  <textarea
                    value={notes}
                    disabled={!editable}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setDirty(true);
                    }}
                    rows={5}
                    maxLength={5000}
                    placeholder="Summarise what was verified and the basis for the risk grade."
                    className="w-full rounded-lg border border-border bg-surface-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary disabled:opacity-60"
                  />
                </label>

                {editable && !allVerified ? (
                  <p className="text-xs text-text-muted">
                    Mark every property section as verified to send the result.
                    If information is incorrect, reject the request instead.
                  </p>
                ) : null}

                {editable ? (
                  <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                    <button
                      type="button"
                      onClick={() => void saveDraft()}
                      disabled={busy !== null || !dirty}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text-primary hover:bg-surface-subtle disabled:opacity-60"
                    >
                      {busy === "draft" ? "Saving…" : "Save Draft"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(true)}
                      disabled={busy !== null}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-danger hover:bg-surface-subtle disabled:opacity-60"
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      onClick={() => void verifyAndSend()}
                      disabled={busy !== null || !canVerify}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icons.Send className="h-4 w-4" />
                      {busy === "verify"
                        ? "Sending…"
                        : "Verify & Send Assessment Result to User"}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {rejecting && !finished ? (
              <div className="mt-4 space-y-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-text-primary">
                    Rejection reason
                  </span>
                  <textarea
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Explain what is incorrect or missing. The requester will see this."
                    className="w-full rounded-lg border border-border bg-surface-canvas px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary hover:bg-surface-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void reject()}
                    disabled={busy !== null || !rejectReason.trim()}
                    className="inline-flex h-9 items-center rounded-lg bg-danger px-3 text-sm font-semibold text-text-inverse disabled:opacity-60"
                  >
                    {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <h3 className="mb-3 text-base font-bold text-text-primary">
              Status history
            </h3>
            <HistoryTimeline events={request.history} />
          </section>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/risk-analysis"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
    >
      <Icons.ArrowBack className="h-4 w-4" />
      Back to request queue
    </Link>
  );
}

function SectionToggle({
  value,
  disabled,
  onChange
}: {
  value: boolean | null;
  disabled: boolean;
  onChange: (value: boolean | null) => void;
}) {
  const options: Array<{
    value: boolean | null;
    label: string;
    active: string;
  }> = [
    {
      value: true,
      label: "Verified",
      active: "border-success/40 bg-success-container text-success-hover"
    },
    {
      value: false,
      label: "Issue found",
      active: "border-danger/40 bg-critical-container text-critical"
    },
    {
      value: null,
      label: "Not checked",
      active: "border-border bg-surface-subtle text-text-primary"
    }
  ];
  return (
    <div
      role="radiogroup"
      className="inline-flex overflow-hidden rounded-lg border border-border"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`border-r border-border px-3 py-1.5 text-xs font-medium last:border-r-0 disabled:cursor-not-allowed ${
              selected
                ? option.active
                : "bg-surface text-text-muted hover:text-text-primary"
            } ${disabled && !selected ? "opacity-50" : ""}`}
          >
            {option.value === true ? (
              <Icons.Check className="mr-1 inline h-3.5 w-3.5" />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
