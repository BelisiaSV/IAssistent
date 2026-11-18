"use client";

import { useActionState } from "react";

import { ZonePicker } from "@/components/exercise-bank/zone-picker";
import { Alert } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type BankEditState, updateBankExercise } from "../../actions";

const m = messages.exerciseBank.admin;
const fields = messages.exerciseBank.fields;

/** Fields in the order of the form: [key, kind]. */
const FORM: [string, "text" | "area" | "lines" | "tags"][] = [
  ["titel", "text"],
  ["type", "text"],
  ["spelfase", "text"],
  ["doelgroep", "text"],
  ["hoofddoel", "area"],
  ["subdoelen", "lines"],
  ["principes", "lines"],
  ["aantal_spelers", "text"],
  ["duur", "text"],
  ["veldafmeting", "text"],
  ["belasting", "text"],
  ["belasting_toelichting", "area"],
  ["organisatie", "lines"],
  ["verloop", "lines"],
  ["regels", "area"],
  ["coachingspunten", "lines"],
  ["makkelijker", "area"],
  ["moeilijker", "area"],
  ["materiaal", "lines"],
  ["tags", "tags"],
];

export function BankEditForm({ number, initial, zones }: { number: string; initial: Record<string, string>; zones: number[] }) {
  const [state, action, pending] = useActionState<BankEditState, FormData>(updateBankExercise.bind(null, number), {});
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="grid gap-4 md:grid-cols-2">
        {FORM.map(([key, kind]) => {
          const label = m.editLabels[key] ?? fields[key] ?? key;
          const wide = kind !== "text";
          const className = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
          return (
            <label key={key} className={`block text-sm font-medium ${wide ? "md:col-span-2" : ""}`}>
              {label}
              {kind === "lines" && <span className="ml-2 text-xs font-normal text-slate-500">{m.editHints.lines}</span>}
              {kind === "tags" && <span className="ml-2 text-xs font-normal text-slate-500">{m.editHints.tags}</span>}
              {kind === "text" || kind === "tags" ? (
                <input name={key} defaultValue={initial[key]} required={key === "titel" || key === "type"} className={className} />
              ) : (
                <textarea name={key} defaultValue={initial[key]} rows={kind === "lines" ? 4 : 3} className={className} />
              )}
            </label>
          );
        })}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {messages.exerciseBank.zonesTitle}
          <span className="ml-2 text-xs font-normal text-slate-500">{m.zonesHint}</span>
        </p>
        <ZonePicker name="zones" initial={zones} />
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{m.saved}</Alert>}
      <button disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
        {pending ? m.saving : m.save}
      </button>
    </form>
  );
}
