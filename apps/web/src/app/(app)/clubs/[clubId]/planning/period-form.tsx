"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import type { FormState } from "@/lib/clubs/form-state";
import { savePeriod } from "@/lib/clubs/planning-actions";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.planning;
const f = m.fields;

export interface PeriodValues {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string;
  age_categories: string[];
  goals: string[];
  focus: string | null;
}

/** Create or change a period of the club planning (in a window). */
export function PeriodForm({ clubId, period }: { clubId: string; period: PeriodValues | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    savePeriod.bind(null, clubId, period?.id ?? null),
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <Field label={f.title}>
        <Input name="title" required maxLength={80} defaultValue={period?.title ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={f.startsOn}>
          <Input type="date" name="startsOn" required defaultValue={period?.starts_on ?? ""} />
        </Field>
        <Field label={f.endsOn}>
          <Input type="date" name="endsOn" required defaultValue={period?.ends_on ?? ""} />
        </Field>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">{f.categories}</legend>
        <div className="flex flex-wrap gap-1.5">
          {AGE_CATEGORIES.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200">
              <input type="checkbox" name="categories" value={c} defaultChecked={period?.age_categories.includes(c)} />
              {(messages.ageCategories as Record<string, string>)[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label={f.goals}>
        <textarea
          name="goals"
          rows={4}
          defaultValue={(period?.goals ?? []).join("\n")}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
        />
      </Field>
      <Field label={f.focus}>
        <textarea
          name="focus"
          rows={2}
          maxLength={600}
          defaultValue={period?.focus ?? ""}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
        />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Button type="submit" disabled={pending}>
        {m.save}
      </Button>
    </form>
  );
}
