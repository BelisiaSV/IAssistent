"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type OpponentFormState, saveOpponentFiche } from "../actions";

const m = messages.opponents;
const textareaClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-50";

export function FicheForm({
  teamId,
  opponentId,
  initial,
  canEdit,
}: {
  teamId: string;
  opponentId: string;
  initial: { name: string; playStyle: string; strengths: string; weaknesses: string; setPieces: string; notes: string; coachName: string; address: string };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<OpponentFormState, FormData>(
    saveOpponentFiche.bind(null, teamId, opponentId),
    {},
  );
  const area = (name: keyof typeof initial, label: string, max: number, placeholder?: string) => (
    <Field label={label}>
      <textarea
        name={name}
        defaultValue={initial[name]}
        rows={3}
        maxLength={max}
        placeholder={placeholder}
        disabled={!canEdit}
        className={textareaClass}
      />
    </Field>
  );
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{m.fiche}</h2>
      <Field label={m.name}>
        <Input name="name" defaultValue={initial.name} required maxLength={120} disabled={!canEdit} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.coachName}>
          <Input name="coachName" defaultValue={initial.coachName} maxLength={120} disabled={!canEdit} />
        </Field>
        <Field label={m.address}>
          <Input name="address" defaultValue={initial.address} maxLength={200} placeholder={m.addressPlaceholder} disabled={!canEdit} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {area("playStyle", m.playStyle, 1000, m.playStylePlaceholder)}
        {area("setPieces", m.setPieces, 1000)}
        {area("strengths", m.strengths, 1000)}
        {area("weaknesses", m.weaknesses, 1000)}
      </div>
      {area("notes", m.notes, 2000)}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {canEdit && (
        <div className="text-right">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : m.saveFiche}
          </Button>
        </div>
      )}
    </form>
  );
}
