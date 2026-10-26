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
  sets: string;
  workMin: string;
  restMin: string;
  intensity: string;
  rpe: string;
  useInPlanning: boolean;
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
  sets: "",
  workMin: "",
  restMin: "",
  intensity: "",
  rpe: "",
  useInPlanning: true,
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
  const area = (name: "organisation" | "course" | "coaching" | "variations", label: string, rows = 4, hint?: string) => (
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
      <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium">{f.load}</legend>
        <p className="text-xs text-slate-500">{f.loadHint}</p>
        <div className="grid gap-4 sm:grid-cols-5">
          <Field label={f.sets}>
            <Input name="sets" type="number" min={1} max={20} defaultValue={initial.sets} />
          </Field>
          <Field label={f.workMin}>
            <Input name="workMin" inputMode="decimal" pattern="[0-9]+([.,][0-9])?" defaultValue={initial.workMin} />
          </Field>
          <Field label={f.restMin}>
            <Input name="restMin" inputMode="decimal" pattern="[0-9]+([.,][0-9])?" defaultValue={initial.restMin} />
          </Field>
          <Field label={f.intensity}>
            <select name="intensity" defaultValue={initial.intensity} className={textareaClass}>
              <option value="">{f.noIntensity}</option>
              {(["laag", "matig", "hoog", "maximaal"] as const).map((i) => (
                <option key={i} value={i}>
                  {m.intensity[i]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={f.rpe}>
            <Input name="rpe" type="number" min={1} max={10} defaultValue={initial.rpe} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="useInPlanning" defaultChecked={initial.useInPlanning} className="h-4 w-4" />
          {f.useInPlanning}
        </label>
      </fieldset>
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
