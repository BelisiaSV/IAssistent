"use client";

import { useActionState } from "react";

import { ContentFields } from "@/components/exercise-bank/content-fields";
import { Alert, Button } from "@/components/ui";
import type { FormAction, FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.exercises;
const categories = messages.ageCategories as Record<string, string>;

/** A club exercise: the fields of the exercise bank plus age categories and level. */
export function ClubExerciseForm({
  action: submit,
  initial,
  zones,
  ages,
  level,
  hint,
}: {
  action: FormAction<FormState>;
  initial: Record<string, string>;
  zones: number[];
  ages: string[];
  level: string;
  hint: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submit,
    {},
  );
  return (
    <form
      action={action}
      className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <p className="text-sm text-slate-600">{hint}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{m.ages}</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_CATEGORIES.map((a) => (
            <label
              key={a}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand/10"
            >
              <input
                type="checkbox"
                name="ages"
                value={a}
                defaultChecked={ages.includes(a)}
                className="accent-brand"
              />
              {categories[a] ?? a}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block max-w-sm text-sm font-medium">
        {m.level}
        <input
          name="level"
          maxLength={60}
          defaultValue={level}
          placeholder={m.levelPlaceholder}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <ContentFields initial={initial} zones={zones} />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? m.saving : m.save}
      </Button>
    </form>
  );
}
