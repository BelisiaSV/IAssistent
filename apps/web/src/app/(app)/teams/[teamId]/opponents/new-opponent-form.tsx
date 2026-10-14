"use client";

import { useActionState } from "react";

import { Alert, Button, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { createOpponent, type OpponentFormState } from "./actions";

const m = messages.opponents;

export function NewOpponentForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState<OpponentFormState, FormData>(createOpponent.bind(null, teamId), {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{m.add}</h2>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-56 flex-1">
          <Input name="name" required maxLength={120} aria-label={m.name} placeholder={m.name} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : m.add}
        </Button>
      </div>
    </form>
  );
}
