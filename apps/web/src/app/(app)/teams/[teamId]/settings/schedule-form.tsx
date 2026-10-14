"use client";

import { useActionState, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { TrainingSlot } from "@/lib/weeks/validation";

import { type FormState, saveTrainingSchedule } from "./actions";

const m = messages.settings.schedule;
// ISO weekdays 1..7 with Dutch names (2024-01-01 was a Monday).
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => ({
  value: i + 1,
  label: new Intl.DateTimeFormat("nl-BE", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))),
}));

const inputClass = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400";

/** The fixed training days of the team: tick the days, set start and duration. */
export function ScheduleForm({ teamId, initial, canEdit }: { teamId: string; initial: TrainingSlot[]; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTrainingSchedule.bind(null, teamId), {});
  const [slots, setSlots] = useState<Record<number, TrainingSlot>>(() =>
    Object.fromEntries(initial.map((slot) => [slot.weekday, slot])),
  );
  const last = Object.values(slots).at(-1);
  const toggle = (weekday: number, on: boolean) =>
    setSlots((current) => {
      const next = { ...current };
      if (on) next[weekday] = { weekday, start: last?.start ?? "19:30", duration_min: last?.duration_min ?? 90 };
      else delete next[weekday];
      return next;
    });
  const update = (weekday: number, patch: Partial<TrainingSlot>) =>
    setSlots((current) => ({ ...current, [weekday]: { ...current[weekday]!, ...patch } }));
  const chosen = Object.values(slots).sort((a, b) => a.weekday - b.weekday);

  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <input type="hidden" name="schedule" value={JSON.stringify(chosen)} />
      <p className="text-sm font-medium">{m.count(chosen.length)}</p>
      <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {WEEKDAYS.map((day) => {
          const slot = slots[day.value];
          return (
            <li key={day.value} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="flex w-36 items-center gap-2 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={!!slot}
                  disabled={!canEdit}
                  onChange={(e) => toggle(day.value, e.target.checked)}
                  className="h-4 w-4"
                />
                {day.label}
              </label>
              {slot && (
                <>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    {m.start}
                    <input
                      type="time"
                      value={slot.start}
                      disabled={!canEdit}
                      onChange={(e) => update(day.value, { start: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    {m.duration}
                    <input
                      type="number"
                      min={30}
                      max={240}
                      step={5}
                      value={slot.duration_min}
                      disabled={!canEdit}
                      onChange={(e) => update(day.value, { duration_min: Number(e.target.value) })}
                      className={`w-20 ${inputClass}`}
                    />
                  </label>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="applyToOpenWeeks" value="1" defaultChecked className="mt-0.5 h-4 w-4" />
          {m.applyToOpenWeeks}
        </label>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {canEdit && (
        <div className="text-right">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      )}
    </form>
  );
}
