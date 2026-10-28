"use client";

import { useActionState } from "react";

import { Alert, Button, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, saveHomeAddress } from "./actions";

const m = messages.settings.venue;

/** Address of the own ground, shown on the dashboard with home matches. */
export function VenueForm({ teamId, initial, canEdit }: { teamId: string; initial: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHomeAddress.bind(null, teamId), {});
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input name="homeAddress" defaultValue={initial} maxLength={200} placeholder={messages.opponents.addressPlaceholder} disabled={!canEdit} aria-label={m.title} />
        </div>
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
