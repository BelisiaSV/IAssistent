"use client";

import { useActionState, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { TrainingSlot } from "@/lib/weeks/validation";

import { type FormState, saveTrainingSchedule } from "./actions";

const m = messages.weeks.schedule;
// ISO weekdays 1..7 with Dutch names (2024-01-01 was a Monday).
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => ({
  value: i + 1,
  label: new Intl.DateTimeFormat("nl-BE", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + i)),
  ),
}));

const inputClass = "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";

export function ScheduleForm({ teamId, initial }: { teamId: string; initial: TrainingSlot[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveTrainingSchedule.bind(null, teamId),
    {},
  );
  const [slots, setSlots] = useState<TrainingSlot[]>(initial);
  const update = (i: number, patch: Partial<TrainingSlot>) =>
    setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <input type="hidden" name="schedule" value={JSON.stringify(slots)} />
      {slots.length === 0 && <p className="text-sm text-slate-500">{m.empty}</p>}
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            {m.weekday}
            <select
              value={slot.weekday}
              onChange={(e) => update(i, { weekday: Number(e.target.value) })}
              className={`block ${inputClass}`}
            >
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            {m.start}
            <input
              type="time"
              value={slot.start}
              onChange={(e) => update(i, { start: e.target.value })}
              className={`block ${inputClass}`}
            />
          </label>
          <label className="text-xs text-slate-600">
            {m.duration}
            <input
              type="number"
              min={30}
              max={240}
              step={5}
              value={slot.duration_min}
              onChange={(e) => update(i, { duration_min: Number(e.target.value) })}
              className={`block w-24 ${inputClass}`}
            />
          </label>
          <button
            type="button"
            onClick={() => setSlots(slots.filter((_, j) => j !== i))}
            className="pb-2 text-sm text-red-700 hover:underline"
          >
            {m.remove}
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={slots.length >= 7}
          onClick={() => setSlots([...slots, { weekday: 2, start: "19:30", duration_min: 90 }])}
          className="text-sm text-brand hover:underline disabled:opacity-50"
        >
          + {m.add}
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : messages.common.save}
        </Button>
      </div>
    </form>
  );
}
