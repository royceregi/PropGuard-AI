"use client";

import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LEVEL_VARIANT, type BlockchainRiskState } from "./BlockchainRiskPanel";

export function AiRiskAssessmentCard({
  state,
  onRun
}: {
  state: BlockchainRiskState;
  onRun: () => void;
}) {
  const { assessment, loading, running } = state;
  const review = assessment?.ai_review ?? null;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-5 md:p-6">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-bold text-text-primary">
        <Icons.SmartToy className="h-[22px] w-[22px] text-primary" />
        AI Risk Assessment
      </h2>

      {loading ? (
        <p className="text-sm text-text-muted">Loading latest assessment…</p>
      ) : !assessment ? (
        <p className="text-sm text-text-muted">
          No assessment yet. Run the AI investigation to have the agents verify
          the ledger and review the risk.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {assessment.risk_level ? (
              <StatusBadge
                label={`${assessment.risk_level} · ${(assessment.risk_score ?? 0).toFixed(2)}`}
                variant={LEVEL_VARIANT[assessment.risk_level]}
                size="md"
              />
            ) : null}
            {review?.suggested_risk_level ? (
              <StatusBadge
                label={`AI suggests ${review.suggested_risk_level}`}
                variant={LEVEL_VARIANT[review.suggested_risk_level]}
                size="sm"
              />
            ) : null}
          </div>

          <p className="text-sm text-text-secondary">
            {review?.summary ?? assessment.explanation}
          </p>

          {review ? (
            <>
              <ReviewList title="Key concerns" items={review.key_concerns} />
              <ReviewList
                title="Recommended actions"
                items={review.recommended_actions}
              />
              <p className="text-[11px] text-text-muted">
                {review.model} · confidence{" "}
                {Math.round(review.confidence * 100)}%
                {review.agrees_with_rules
                  ? " · agrees with rule score"
                  : " · disagrees with rule score (rule score kept)"}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-text-muted">
              No AI review for this assessment (AI disabled or unavailable when
              it ran). Showing the rule-based explanation.
            </p>
          )}

          <p className="text-xs text-text-muted">
            The score comes from the blockchain rule set; the AI explains it.
            This is a risk indicator, not a legal fraud judgment.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-subtle disabled:opacity-60"
      >
        <Icons.AutoAwesome
          className={`h-4 w-4 ${running ? "animate-pulse" : ""}`}
        />
        {running
          ? "Agents running…"
          : assessment
            ? "Re-run AI investigation"
            : "Run AI investigation"}
      </button>
    </section>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-text-muted uppercase">
        {title}
      </p>
      <ul className="mt-1 list-disc pl-5 text-xs text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
