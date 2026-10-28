"use client";

import type { FormationCatalog } from "@iassistent/staff-engine/content";
import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { createLineup, type LineupFormState } from "./actions";

const m = messages.lineups;

export function NewLineupForm({ teamId, formations }: { teamId: string; formations: FormationCatalog }) {
  const [state, action, pending] = useActionState<LineupFormState, FormData>(
    createLineup.bind(null, teamId),
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{m.new}</h2>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.titleLabel} error={errors.title}>
          <Input name="title" required maxLength={120} placeholder={m.titlePlaceholder} />
        </Field>
        <Field label={m.opponent} error={errors.opponent}>
          <Input name="opponent" maxLength={120} />
        </Field>
        <Field label={m.matchDate} error={errors.matchDate}>
          <Input name="matchDate" type="date" />
        </Field>
        <Field label={m.formation} error={errors.formation}>
          <select
            name="formation"
            defaultValue={formations.formaties[0]?.code}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            {formations.formaties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.naam}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="text-right">
        <Button type="submit" disabled={pending}>
          {m.create}
        </Button>
      </div>
    </form>
  );
}
