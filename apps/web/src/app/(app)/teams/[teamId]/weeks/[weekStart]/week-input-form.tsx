"use client";

import { type MatchDayCatalog, matchDayFor } from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState, useMemo, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { WeekMatch, WeekTraining } from "@/lib/weeks/validation";

import { type FormState, saveWeekPlan } from "../actions";

const m = messages.weeks.input;
const inputClass = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50";

type DayState = {
  kind: "none" | "training" | "match";
  start: string;
  duration: number;
  opponent: string;
  home: boolean;
};

export function WeekInputForm({
  teamId,
  weekStart,
  days,
  initial,
  matchDays,
  opponents,
  canEdit,
}: {
  teamId: string;
  weekStart: string;
  days: { date: string; weekday: string; label: string }[];
  initial: { trainings: WeekTraining[]; matches: WeekMatch[]; previousMatchDate: string | null; notes: string | null };
  matchDays: MatchDayCatalog;
  /** Names of known opponents, suggested while typing. */
  opponents: string[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveWeekPlan.bind(null, teamId, weekStart),
    {},
  );
  const [dirty, setDirty] = useState(false);
  const [previousMatchDate, setPreviousMatchDate] = useState(initial.previousMatchDate ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [week, setWeek] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(
      days.map(({ date }) => {
        const training = initial.trainings.find((t) => t.date === date);
        const match = initial.matches.find((x) => x.date === date);
        return [
          date,
          {
            kind: match ? "match" : training ? "training" : "none",
            start: match?.start ?? training?.start ?? "19:30",
            duration: training?.duration_min ?? 90,
            opponent: match?.opponent ?? "",
            home: match?.home ?? true,
          },
        ];
      }),
    ),
  );

  const update = (date: string, patch: Partial<DayState>) => {
    setWeek({ ...week, [date]: { ...week[date]!, ...patch } });
    setDirty(true);
  };

  const labels = useMemo(() => {
    const matches = days.filter((d) => week[d.date]!.kind === "match").map((d) => d.date);
    const around = previousMatchDate ? [previousMatchDate, ...matches] : matches;
    return Object.fromEntries(days.map((d) => [d.date, matchDayFor(d.date, around, matchDays)]));
  }, [days, week, previousMatchDate, matchDays]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      trainings: days
        .filter((d) => week[d.date]!.kind === "training")
        .map((d) => ({ date: d.date, start: week[d.date]!.start, duration_min: week[d.date]!.duration })),
      matches: days
        .filter((d) => week[d.date]!.kind === "match")
        .map((d) => ({
          date: d.date,
          start: week[d.date]!.start,
          opponent: week[d.date]!.opponent,
          home: week[d.date]!.home,
        })),
      previousMatchDate,
      notes,
    };
    const formData = new FormData();
    formData.set("week", JSON.stringify(payload));
    startTransition(() => action(formData));
    setDirty(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{m.title}</h2>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && !dirty && <Alert tone="success">{state.success}</Alert>}
      {dirty && canEdit && <p className="text-xs text-amber-700">{m.unsaved}</p>}

      <div className="divide-y divide-slate-100">
        {days.map((day) => {
          const d = week[day.date]!;
          const label = labels[day.date];
          return (
            <div key={day.date} className="flex flex-wrap items-center gap-3 py-2">
              <div className="w-40">
                <span className="block text-sm font-medium capitalize">{day.weekday}</span>
                <span className="block text-xs text-slate-500">{day.label}</span>
              </div>
              <span
                title={label?.uitleg}
                className={`w-14 rounded px-1.5 py-0.5 text-center font-mono text-xs ${
                  label ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                {label?.code ?? "–"}
              </span>
              <select
                aria-label={m.activity}
                disabled={!canEdit}
                value={d.kind}
                onChange={(e) => update(day.date, { kind: e.target.value as DayState["kind"] })}
                className={inputClass}
              >
                <option value="none">{m.none}</option>
                <option value="training">{m.training}</option>
                <option value="match">{m.match}</option>
              </select>
              {d.kind !== "none" && (
                <input
                  type="time"
                  aria-label={m.start}
                  disabled={!canEdit}
                  value={d.start}
                  onChange={(e) => update(day.date, { start: e.target.value })}
                  className={inputClass}
                />
              )}
              {d.kind === "training" && (
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="number"
                    min={30}
                    max={240}
                    step={5}
                    disabled={!canEdit}
                    value={d.duration}
                    onChange={(e) => update(day.date, { duration: Number(e.target.value) })}
                    className={`w-20 ${inputClass}`}
                  />
                  min
                </label>
              )}
              {d.kind === "match" && (
                <>
                  <input
                    aria-label={m.opponent}
                    placeholder={m.opponent}
                    disabled={!canEdit}
                    value={d.opponent}
                    maxLength={120}
                    list="opponent-names"
                    onChange={(e) => update(day.date, { opponent: e.target.value })}
                    className={`min-w-40 flex-1 ${inputClass}`}
                  />
                  <select
                    disabled={!canEdit}
                    value={d.home ? "home" : "away"}
                    onChange={(e) => update(day.date, { home: e.target.value === "home" })}
                    className={inputClass}
                  >
                    <option value="home">{m.home}</option>
                    <option value="away">{m.away}</option>
                  </select>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">{m.previousMatch}</span>
          <input
            type="date"
            disabled={!canEdit}
            value={previousMatchDate}
            max={weekStart}
            onChange={(e) => {
              setPreviousMatchDate(e.target.value);
              setDirty(true);
            }}
            className={`mt-1 block w-full ${inputClass}`}
          />
          <span className="text-xs text-slate-500">{m.previousMatchHint}</span>
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">{m.notes}</span>
          <textarea
            rows={3}
            maxLength={1000}
            disabled={!canEdit}
            value={notes}
            placeholder={m.notesHint}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            className={`mt-1 block w-full ${inputClass}`}
          />
        </label>
      </div>

      {canEdit && (
        <div className="text-right">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      )}
      <datalist id="opponent-names">
        {opponents.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </form>
  );
}
