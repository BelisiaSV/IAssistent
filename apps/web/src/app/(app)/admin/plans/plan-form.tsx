"use client";

import { useActionState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";
import { AUDIENCES, BILLING_PERIODS, type Plan, planFeatures, priceInput } from "@/lib/plans/plans";

import { type PlanFormState, savePlan } from "./actions";

const m = messages.plans;
const f = m.fields;
const selectClass = "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

/** Create or edit a price plan. */
export function PlanForm({ plan }: { plan: Plan | null }) {
  const [state, action, pending] = useActionState<PlanFormState, FormData>(savePlan.bind(null, plan?.id ?? null), {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={f.name}>
          <Input name="name" required maxLength={60} defaultValue={plan?.name ?? ""} />
        </Field>
        <Field label={f.code} hint={f.codeHint}>
          <Input name="code" required maxLength={40} defaultValue={plan?.code ?? ""} />
        </Field>
        <Field label={f.audience}>
          <select name="audience" defaultValue={plan?.audience ?? "club"} className={selectClass}>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {m.audience[a]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={f.description}>
        <Input name="description" maxLength={300} defaultValue={plan?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={f.price} hint={f.priceHint}>
          <Input name="price" inputMode="decimal" defaultValue={priceInput(plan?.price_cents ?? null)} />
        </Field>
        <Field label={f.billingPeriod}>
          <select name="billingPeriod" defaultValue={plan?.billing_period ?? "year"} className={selectClass}>
            {BILLING_PERIODS.map((b) => (
              <option key={b} value={b}>
                {f.billing[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={f.yearlyPrice} hint={f.yearlyPriceHint}>
          <Input name="yearlyPrice" inputMode="decimal" defaultValue={priceInput(plan?.yearly_price_cents ?? null)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={f.maxCoaches} hint={f.limitHint}>
          <Input name="maxCoaches" type="number" min={1} max={1000} defaultValue={plan?.max_coaches ?? ""} />
        </Field>
        <Field label={f.maxTeams} hint={f.limitHint}>
          <Input name="maxTeams" type="number" min={1} max={1000} defaultValue={plan?.max_teams ?? ""} />
        </Field>
        <Field label={f.sortOrder}>
          <Input name="sortOrder" type="number" min={0} max={1000} defaultValue={plan?.sort_order ?? 0} />
        </Field>
      </div>
      <Field label={f.features} hint={f.featuresHint}>
        <textarea
          name="features"
          rows={6}
          defaultValue={plan ? planFeatures(plan).join("\n") : ""}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
        />
      </Field>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="recommended" defaultChecked={plan?.recommended ?? false} />
          {f.recommended}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} />
          {f.active}
        </label>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="text-right">
        <Button type="submit" disabled={pending}>
          {pending ? messages.common.saving : m.save}
        </Button>
      </div>
    </form>
  );
}
