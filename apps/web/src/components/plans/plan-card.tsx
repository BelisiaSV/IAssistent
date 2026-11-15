import type { ReactNode } from "react";

import { messages } from "@/lib/messages";
import { formatPrice, type Plan, planFeatures } from "@/lib/plans/plans";

const m = messages.plans;

/** A price plan as the customer sees it: name, price, limits and features. */
export function PlanCard({ plan, current = false, footer }: { plan: Plan; current?: boolean; footer?: ReactNode }) {
  const features = planFeatures(plan);
  return (
    <article
      className={`relative flex h-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ${
        current ? "ring-2 ring-emerald-500" : plan.recommended ? "ring-2 ring-brand" : "ring-slate-200"
      } ${plan.active ? "" : "opacity-60"}`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold tracking-[0.15em] text-slate-500 uppercase">{m.audience[plan.audience] ?? plan.audience}</span>
        {plan.recommended && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">{m.recommended}</span>}
        {current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{m.account.yourPlan}</span>}
        {!plan.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{m.inactive}</span>}
      </div>
      <div>
        <h3 className="text-xl font-extrabold text-slate-900">{plan.name}</h3>
        {plan.description && <p className="text-sm text-slate-500">{plan.description}</p>}
      </div>
      <div>
        {plan.price_cents === null ? (
          <p className="text-2xl font-black text-slate-900">{m.priceOnRequest}</p>
        ) : (
          <p className="text-3xl font-black text-slate-900 tabular-nums">
            {formatPrice(plan.price_cents)}
            <span className="ml-1 text-sm font-semibold text-slate-500">{plan.billing_period === "month" ? m.perMonth : m.perYear}</span>
          </p>
        )}
        {plan.billing_period === "month" && plan.yearly_price_cents !== null && (
          <p className="text-xs text-slate-500">{m.yearly(formatPrice(plan.yearly_price_cents))}</p>
        )}
      </div>
      {(plan.max_coaches || plan.max_teams) && (
        <p className="text-sm font-semibold text-slate-700">
          {[plan.max_coaches ? m.upToCoaches(plan.max_coaches) : null, plan.max_teams ? m.upToTeams(plan.max_teams) : null].filter(Boolean).join(" · ")}
        </p>
      )}
      {features.length > 0 && (
        <ul className="space-y-1.5 text-sm text-slate-700">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="mt-auto pt-2">{footer}</div>}
    </article>
  );
}
