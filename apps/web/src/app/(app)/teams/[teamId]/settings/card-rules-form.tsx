"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { CardRules } from "@/lib/players/cards";

import { type FormState, saveCardRules } from "./actions";

const m = messages.cards.rules;

/** How yellow and red cards lead to a suspension. */
export function CardRulesForm({ teamId, initial, canEdit }: { teamId: string; initial: CardRules; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCardRules.bind(null, teamId), {});
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
        <Field label={m.yellowLimit}>
          <Input type="number" name="yellowLimit" min={1} max={20} defaultValue={initial.yellowLimit} disabled={!canEdit} />
        </Field>
        <Field label={m.yellowBan}>
          <Input type="number" name="yellowBan" min={0} max={10} defaultValue={initial.yellowBan} disabled={!canEdit} />
        </Field>
        <Field label={m.redBan}>
          <Input type="number" name="redBan" min={0} max={20} defaultValue={initial.redBan} disabled={!canEdit} />
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
