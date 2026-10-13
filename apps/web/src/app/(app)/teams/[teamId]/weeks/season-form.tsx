"use client";

import { useActionState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, saveSeasonSettings } from "./actions";

const m = messages.weeks.season;

export function SeasonForm({
  teamId,
  competitionStartDate,
  periodizationWeeks,
  cycles,
}: {
  teamId: string;
  competitionStartDate: string | null;
  periodizationWeeks: number;
  cycles: number[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveSeasonSettings.bind(null, teamId),
    {},
  );
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block font-medium text-slate-700">{m.competitionStart}</span>
          <input
            type="date"
            name="competitionStartDate"
            defaultValue={competitionStartDate ?? ""}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-slate-700">{m.cycle}</span>
          <select
            name="periodizationWeeks"
            defaultValue={periodizationWeeks}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {cycles.map((n) => (
              <option key={n} value={n}>
                {m.cycleWeeks(n)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : messages.common.save}
        </Button>
      </div>
    </form>
  );
}
