"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import type { ExerciseFormState } from "./actions";

const m = messages.exercises;
const f = m.form;
const textareaClass = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

export interface ExerciseValues {
  title: string;
  phase: string;
  labels: string;
  minPlayers: string;
  maxPlayers: string;
  duration: string;
  organisation: string;
  course: string;
  coaching: string;
  variations: string;
}

export const EMPTY_EXERCISE: ExerciseValues = {
  title: "",
  phase: "",
  labels: "",
  minPlayers: "",
  maxPlayers: "",
  duration: "",
  organisation: "",
  course: "",
  coaching: "",
  variations: "",
};

export function ExerciseForm({
  action,
  initial,
}: {
  action: (prev: ExerciseFormState, formData: FormData) => Promise<ExerciseFormState>;
  initial: ExerciseValues;
}) {
  const [state, formAction, pending] = useActionState<ExerciseFormState, FormData>(action, {});
  const area = (name: keyof ExerciseValues, label: string, rows = 4, hint?: string) => (
    <Field label={label} hint={hint}>
      <textarea name={name} defaultValue={initial[name]} rows={rows} className={textareaClass} />
    </Field>
  );
  return (
    <form action={formAction} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label={f.title}>
          <Input name="title" required maxLength={120} defaultValue={initial.title} />
        </Field>
        <Field label={f.phase}>
          <select name="phase" defaultValue={initial.phase} className={textareaClass}>
            <option value="">{f.noPhase}</option>
            {(["opwarming", "kern", "afsluiting"] as const).map((p) => (
              <option key={p} value={p}>
                {m.phase[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={f.labels} hint={f.labelsHint}>
        <Input name="labels" maxLength={600} defaultValue={initial.labels} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={f.minPlayers}>
          <Input name="minPlayers" type="number" min={1} max={40} defaultValue={initial.minPlayers} />
        </Field>
        <Field label={f.maxPlayers}>
          <Input name="maxPlayers" type="number" min={1} max={40} defaultValue={initial.maxPlayers} />
        </Field>
        <Field label={f.duration}>
          <Input name="duration" type="number" min={1} max={120} defaultValue={initial.duration} />
        </Field>
      </div>
      {area("organisation", f.organisation, 3)}
      <div className="grid gap-4 md:grid-cols-3">
        {area("course", f.course, 6, f.linesHint)}
        {area("coaching", f.coaching, 6, f.linesHint)}
        {area("variations", f.variations, 6, f.linesHint)}
      </div>
      <div className="text-right">
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : f.save}
        </Button>
      </div>
    </form>
  );
}
