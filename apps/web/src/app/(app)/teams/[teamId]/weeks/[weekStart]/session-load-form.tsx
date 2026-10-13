"use client";

import { useActionState } from "react";

import { messages } from "@/lib/messages";

import { type FormState, saveSessionLoad } from "../actions";

const m = messages.weeks.load;
const inputClass = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50";

/** One row to log the actual load (average RPE of the group) of a session. */
export function SessionLoadForm({
  teamId,
  weekStart,
  session,
  canEdit,
}: {
  teamId: string;
  weekStart: string;
  session: {
    date: string;
    kind: "training" | "match";
    label: string;
    rpe: number | null;
    duration: number;
    attendance: number | null;
  };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveSessionLoad.bind(null, teamId, weekStart),
    {},
  );
  const au = session.rpe !== null ? Math.round(session.rpe * session.duration) : null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3 py-2">
      <input type="hidden" name="date" value={session.date} />
      <input type="hidden" name="kind" value={session.kind} />
      <span className="w-48 text-sm">{session.label}</span>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        {m.rpe}
        <input
          name="rpe"
          type="number"
          min={0}
          max={10}
          step={0.5}
          defaultValue={session.rpe ?? ""}
          disabled={!canEdit}
          className={`w-16 ${inputClass}`}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        {m.duration}
        <input
          name="duration"
          type="number"
          min={1}
          max={300}
          defaultValue={session.duration}
          disabled={!canEdit}
          className={`w-20 ${inputClass}`}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        {m.attendance}
        <input
          name="attendance"
          type="number"
          min={0}
          max={60}
          defaultValue={session.attendance ?? ""}
          disabled={!canEdit}
          className={`w-16 ${inputClass}`}
        />
      </label>
      <span className="w-20 text-sm font-medium tabular-nums">{au !== null ? `${au} ${m.au}` : "–"}</span>
      {canEdit && (
        <button type="submit" disabled={pending} className="text-sm text-brand hover:underline disabled:opacity-50">
          {pending ? messages.common.saving : messages.common.save}
        </button>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
    </form>
  );
}
