"use client";

import type { MeetingWeekPlan, WeekPlanDay } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { useState } from "react";

import { messages } from "@/lib/messages";
import { shortDate } from "@/lib/weeks/dates";

const m = messages.staffRoom.meeting.week;

const LOAD_COLORS: Record<string, string> = { rust: "#64748b", laag: "#22c55e", matig: "#eab308", hoog: "#f97316", "zeer hoog": "#ef4444" };
const KIND_COLORS: Record<string, string> = { training: "#3b82f6", wedstrijd: "#22c55e", rust: "#64748b" };

/**
 * The full week from a staff meeting: availability, the plan for the head
 * coach (every day with its blocks, exercises and load) and the plan for the
 * players. Shirt numbers get their names here; the AI never saw them.
 */
export function WeekPlanView({ plan, names }: { plan: MeetingWeekPlan; names: Record<number, string> }) {
  const [view, setView] = useState<"coach" | "players">("coach");
  const who = (n: number | null) => (n === null ? "?" : names[n] ? `${n} · ${names[n]}` : `#${n}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-semibold">{m.title(shortDate(plan.week_van))}</h4>
        <div role="tablist" className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {(["coach", "players"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 font-medium ${view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {v === "coach" ? m.coach : m.players}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-sm font-semibold">
          <span className="text-green-700">{m.available(plan.beschikbaarheid.beschikbaar)}</span>
          {plan.beschikbaarheid.niet_beschikbaar.length > 0 && <span className="text-slate-500"> · {m.unavailable}:</span>}
        </p>
        {plan.beschikbaarheid.niet_beschikbaar.length ? (
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {plan.beschikbaarheid.niet_beschikbaar.map((p, i) => (
              <li key={`${p.rugnummer}-${i}`} className="rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-200">
                <span className="font-medium">{who(p.rugnummer)}</span> <span className="text-red-700">— {p.reden}</span>
                {p.terug_verwacht && <span className="text-xs text-slate-500"> ({m.back(shortDate(p.terug_verwacht))})</span>}
                {p.aanpassing && <span className="block text-xs text-slate-600">{p.aanpassing}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{m.none}</p>
        )}
      </div>

      {view === "coach" ? (
        <ol className="space-y-3">
          {plan.dagen.map((day) => (
            <DayCard key={day.datum} day={day} />
          ))}
        </ol>
      ) : (
        <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {plan.spelersplanning.map((d) => (
            <li key={d.datum} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="w-36 shrink-0 font-semibold whitespace-nowrap capitalize">
                {d.weekdag} {shortDate(d.datum)}
              </span>
              <span className="min-w-0 flex-1">{d.activiteit}</span>
              {d.aanvang && <span className="font-semibold tabular-nums">{d.aanvang}</span>}
              {d.opmerking && <span className="basis-full pl-0 text-xs text-slate-500 sm:pl-39">{d.opmerking}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function DayCard({ day }: { day: WeekPlanDay }) {
  const color = KIND_COLORS[day.soort] ?? "#64748b";
  return (
    <li className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2">
        <span className="font-semibold capitalize">
          {day.weekdag} {shortDate(day.datum)}
        </span>
        {day.md && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">{day.md}</span>}
        <span className="flex-1" />
        {day.tijdstip && <span className="text-sm font-semibold tabular-nums">{day.tijdstip}</span>}
        {day.totale_duur_min ? <span className="text-xs text-slate-500">{m.total(day.totale_duur_min)}</span> : null}
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: LOAD_COLORS[day.belasting] ?? "#64748b" }}>
          {m.load}: {day.belasting}
        </span>
      </div>
      <p className="px-3 pt-0.5 pb-1 text-sm font-medium text-slate-800">{day.soort === "rust" ? day.titel || m.restDay : day.titel}</p>
      {(day.doel || day.opmerking) && (
        <div className="px-3 pb-2 text-xs text-slate-600">
          {day.doel}
          {day.opmerking && <span className="block text-amber-800">{day.opmerking}</span>}
        </div>
      )}
      {day.onderdelen.length > 0 && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-1.5 font-medium">{m.block}</th>
                <th className="px-3 py-1.5 font-medium">{m.exercise}</th>
                <th className="px-3 py-1.5 text-right font-medium">{m.duration}</th>
                <th className="px-3 py-1.5 font-medium">{m.load}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {day.onderdelen.map((part, i) => (
                <tr key={`${part.naam}-${i}`}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-slate-500">{m.phases[part.fase] ?? part.fase}</td>
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {part.naam}
                        {part.spelers && <span className="font-normal text-slate-500"> · {part.spelers}</span>}
                      </summary>
                      <div className="mt-1 space-y-1 text-xs text-slate-600">
                        {part.organisatie && (
                          <p>
                            <span className="font-semibold">{m.organisation}:</span> {part.organisatie}
                          </p>
                        )}
                        {part.coachingspunten.length > 0 && (
                          <p>
                            <span className="font-semibold">{m.coaching}:</span> {part.coachingspunten.join(" · ")}
                          </p>
                        )}
                        {part.oefening_id && (
                          <Link href={`/exercises/${part.oefening_id}`} className="font-medium text-brand hover:underline">
                            {m.openExercise} →
                          </Link>
                        )}
                      </div>
                    </details>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{m.minutes(part.duur_min)}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {(part.reeksen || part.werk_per_reeks) && (
                      <span className="block font-semibold text-slate-800">
                        {part.reeksen ? `${part.reeksen} × ${part.werk_per_reeks ?? "–"}` : part.werk_per_reeks}
                      </span>
                    )}
                    {part.rust_tussen_reeksen && (
                      <span className="block text-slate-600">
                        {m.rest}: {part.rust_tussen_reeksen}
                      </span>
                    )}
                    <span className="block text-slate-600">
                      {part.intensiteit}
                      {part.rpe ? ` · ${m.rpe} ${part.rpe}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}
