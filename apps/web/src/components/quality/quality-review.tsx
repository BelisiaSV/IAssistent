import type { ReactNode } from "react";

import { messages } from "@/lib/messages";

const m = messages.quality;

export interface QualityReviewRow {
  status: string;
  output: unknown;
  average: number | null;
  verdict: string | null;
  created_at: string;
}

interface Output {
  samenvatting: string;
  criteria: { code: string; score: number; toelichting: string }[];
  sterke_punten: string[];
  verbeterpunten: { criterium: string; punt: string }[];
}

export interface QualityLabels {
  /** Criterion code → name. */
  criteria: Record<string, string>;
  /** Verdict code → label. */
  verdicts: Record<string, string>;
  max: number;
}

const VERDICT_TONE: Record<string, string> = {
  goed: "bg-emerald-100 text-emerald-800",
  voldoende: "bg-amber-100 text-amber-800",
};

const average = (n: number) => n.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The verdict as a small label with the average (club dashboard, week versions). */
export function QualityBadge({ review, labels }: { review: QualityReviewRow; labels: QualityLabels }) {
  if (review.status !== "ready" || review.average === null || !review.verdict) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${VERDICT_TONE[review.verdict] ?? "bg-red-100 text-red-800"}`}
      title={m.title}
    >
      {labels.verdicts[review.verdict] ?? review.verdict} · {m.average(average(Number(review.average)), labels.max)}
    </span>
  );
}

/**
 * Training Quality Engine: the check of one week version — verdict, score per
 * criterion, improvement points and strengths. `action` is the (re)check button.
 */
export function QualityReview({
  review,
  labels,
  action,
}: {
  review: QualityReviewRow | null;
  labels: QualityLabels;
  action?: ReactNode;
}) {
  const output = review?.status === "ready" ? (review.output as Output) : null;
  return (
    <section className="space-y-3 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200 print:hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{m.title}</h3>
        {review && <QualityBadge review={review} labels={labels} />}
        <span className="min-w-0 flex-1 text-xs text-slate-500">
          {!review ? m.none : review.status === "failed" ? m.failed : m.checkedAt(new Date(review.created_at).toLocaleString("nl-BE", { timeZone: "Europe/Brussels", dateStyle: "medium", timeStyle: "short" }))}
        </span>
        {action}
      </div>
      {output && (
        <>
          <p className="text-sm text-slate-700">{output.samenvatting}</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {output.criteria.map((c) => (
              <li key={c.code} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                <span className="w-44 shrink-0 font-medium">{labels.criteria[c.code] ?? c.code}</span>
                <span className="flex shrink-0 gap-0.5" aria-label={`${c.score} / ${labels.max}`}>
                  {Array.from({ length: labels.max }, (_, i) => (
                    <span key={i} className={`h-2 w-4 rounded-sm ${i < c.score ? (c.score >= 4 ? "bg-emerald-500" : c.score === 3 ? "bg-amber-400" : "bg-red-500") : "bg-slate-200"}`} />
                  ))}
                </span>
                <span className="min-w-0 flex-1 text-xs text-slate-600">{c.toelichting}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 md:grid-cols-2">
            {output.verbeterpunten.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700">{m.improvements}</h4>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {output.verbeterpunten.map((v, i) => (
                    <li key={i}>
                      {v.punt} <span className="text-xs text-slate-500">({labels.criteria[v.criterium] ?? v.criterium})</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {output.sterke_punten.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700">{m.strengths}</h4>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {output.sterke_punten.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
