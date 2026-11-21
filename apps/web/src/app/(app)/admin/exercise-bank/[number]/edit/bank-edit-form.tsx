"use client";

import { useActionState } from "react";

import { ContentFields } from "@/components/exercise-bank/content-fields";
import { Alert } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type BankEditState, updateBankExercise } from "../../actions";

const m = messages.exerciseBank.admin;

export function BankEditForm({ number, initial, zones }: { number: string; initial: Record<string, string>; zones: number[] }) {
  const [state, action, pending] = useActionState<BankEditState, FormData>(updateBankExercise.bind(null, number), {});
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <ContentFields initial={initial} zones={zones} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{m.saved}</Alert>}
      <button disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {pending ? m.saving : m.save}
      </button>
    </form>
  );
}
