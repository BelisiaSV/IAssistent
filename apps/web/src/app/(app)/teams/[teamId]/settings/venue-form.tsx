"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, saveTeamDetails } from "./actions";

const m = messages.settings.venue;

/** Own ground (shown with home matches) and the formation on the dashboard. */
export function VenueForm({
  teamId,
  initial,
  formations,
  canEdit,
}: {
  teamId: string;
  initial: { homeAddress: string; formation: string };
  formations: { code: string; naam: string }[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTeamDetails.bind(null, teamId), {});
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <Field label={m.address}>
          <Input name="homeAddress" defaultValue={initial.homeAddress} maxLength={200} placeholder={messages.opponents.addressPlaceholder} disabled={!canEdit} />
        </Field>
        <Field label={m.formation}>
          <select
            name="formation"
            defaultValue={initial.formation}
            disabled={!canEdit}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-50"
          >
            {formations.map((f) => (
              <option key={f.code} value={f.code}>
                {f.naam}
              </option>
            ))}
          </select>
        </Field>
        {canEdit && (
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        )}
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </form>
  );
}
