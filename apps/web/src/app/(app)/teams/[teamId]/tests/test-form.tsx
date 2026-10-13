"use client";

import { useActionState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";

import { saveTestResults, type TestFormState } from "./actions";

const m = messages.tests;

export function TestForm({
  teamId,
  test,
  today,
  players,
}: {
  teamId: string;
  test: { code: string; naam: string; eenheid: string; min: number; max: number };
  today: string;
  players: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<TestFormState, FormData>(
    saveTestResults.bind(null, teamId, test.code),
    {},
  );
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h3 className="font-semibold">
        {m.newSession}: {test.naam}
      </h3>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <label className="block text-sm">
        <span className="font-medium text-slate-700">{m.date}</span>
        <input
          type="date"
          name="date"
          required
          defaultValue={today}
          className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {players.map((p) => (
          <label key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{p.label}</span>
            <input
              name={`result:${p.id}`}
              type="number"
              inputMode="decimal"
              min={test.min}
              max={test.max}
              step={0.5}
              aria-label={m.result(test.eenheid)}
              placeholder={test.eenheid}
              className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm"
            />
          </label>
        ))}
      </div>
      <div className="text-right">
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : messages.common.save}
        </Button>
      </div>
    </form>
  );
}
