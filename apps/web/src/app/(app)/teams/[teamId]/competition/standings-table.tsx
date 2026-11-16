"use client";

import { useState } from "react";

import { messages } from "@/lib/messages";
import { OUTCOME_COLORS, type Outcome } from "@/lib/teams/dashboard";

const m = messages.competition.page;
const letters = messages.dashboard.form.letter;

type Row = {
  period: number;
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: Outcome[];
};

/** The standings of a division, per period, with the own team highlighted. */
export function StandingsTable({ rows, own }: { rows: Row[]; own: string }) {
  const periods = [...new Set(rows.map((r) => r.period))].sort((a, b) => a - b);
  const [period, setPeriod] = useState(periods[0] ?? 0);
  const shown = rows.filter((r) => r.period === period).sort((a, b) => a.position - b.position);
  const c = m.columns;

  return (
    <div className="space-y-3">
      {periods.length > 1 && (
        <div role="tablist" aria-label={m.period} className="flex flex-wrap gap-1 text-sm">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 font-medium ${p === period ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {m.periods(p)}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5 pr-2 font-medium">{c.pos}</th>
              <th className="py-1.5 pr-2 font-medium">{c.team}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.played}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.won}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.drawn}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.lost}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.goals}</th>
              <th className="py-1.5 pr-2 text-right font-medium">{c.points}</th>
              <th className="hidden py-1.5 font-medium sm:table-cell" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.team} className={r.team === own ? "bg-brand/10 font-semibold" : ""}>
                <td className="py-1.5 pr-2 tabular-nums">{r.position}</td>
                <td className="py-1.5 pr-2">{r.team}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.played}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.won}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.drawn}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{r.lost}</td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap tabular-nums">
                  {r.goalsFor}-{r.goalsAgainst}
                </td>
                <td className="py-1.5 pr-2 text-right font-bold tabular-nums">{r.points}</td>
                <td className="hidden py-1.5 sm:table-cell">
                  <span className="flex gap-0.5">
                    {r.form.map((o, i) => (
                      <span key={i} className="flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-bold text-white" style={{ backgroundColor: OUTCOME_COLORS[o] }}>
                        {letters[o]}
                      </span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
