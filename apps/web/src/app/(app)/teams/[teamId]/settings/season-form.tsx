"use client";

import { useActionState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, saveSeasonSettings } from "./actions";

const m = messages.settings.season;
const inputClass = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";

/** Season planning: preparation and competition, each with its own cycle. */
export function SeasonForm({
  teamId,
  initial,
  cycles,
  canEdit,
}: {
  teamId: string;
  initial: { preparationStart: string | null; preparationWeeks: number; competitionStart: string | null; competitionWeeks: number };
  cycles: number[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSeasonSettings.bind(null, teamId), {});
  const phase = (title: string, hint: string, dateName: string, dateLabel: string, date: string | null, cycleName: string, cycle: number) => (
    <fieldset className="space-y-3 rounded-lg p-4 ring-1 ring-slate-200">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <p className="text-xs text-slate-600">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-700">{dateLabel}</span>
          <input type="date" name={dateName} defaultValue={date ?? ""} disabled={!canEdit} className={inputClass} />
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">{m.cycle}</span>
          <select name={cycleName} defaultValue={cycle} disabled={!canEdit} className={inputClass}>
            {cycles.map((n) => (
              <option key={n} value={n}>
                {m.cycleWeeks(n)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );

  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {phase(m.preparation, m.preparationHint, "preparationStartDate", m.preparationStart, initial.preparationStart, "preparationWeeks", initial.preparationWeeks)}
        {phase(m.competition, m.competitionHint, "competitionStartDate", m.competitionStart, initial.competitionStart, "competitionWeeks", initial.competitionWeeks)}
      </div>
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
