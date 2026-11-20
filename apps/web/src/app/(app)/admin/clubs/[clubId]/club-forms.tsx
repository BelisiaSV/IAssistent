"use client";

import { CLUB_MODULES } from "@iassistent/db";
import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type FormState, setSubscription, updateClub } from "../actions";

const m = messages.clubAdmin;
const selectClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

export interface ClubDetails {
  name: string;
  federation_number: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

export function DetailsForm({
  clubId,
  club,
}: {
  clubId: string;
  club: ClubDetails;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateClub.bind(null, clubId),
    {},
  );
  const d = m.details;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label={d.name}>
          <Input
            name="name"
            required
            maxLength={120}
            defaultValue={club.name}
          />
        </Field>
        <Field label={d.number}>
          <Input
            name="number"
            maxLength={10}
            defaultValue={club.federation_number ?? ""}
          />
        </Field>
      </div>
      <Field label={d.address}>
        <Input
          name="address"
          maxLength={200}
          defaultValue={club.address ?? ""}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={d.contactName}>
          <Input
            name="contactName"
            maxLength={120}
            defaultValue={club.contact_name ?? ""}
          />
        </Field>
        <Field label={d.contactEmail}>
          <Input
            name="contactEmail"
            type="email"
            maxLength={200}
            defaultValue={club.contact_email ?? ""}
          />
        </Field>
        <Field label={d.contactPhone}>
          <Input
            name="contactPhone"
            maxLength={40}
            defaultValue={club.contact_phone ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={d.primaryColor}>
          <Input
            name="primaryColor"
            placeholder="#6CB4EE"
            maxLength={7}
            defaultValue={club.primary_color ?? ""}
          />
        </Field>
        <Field label={d.secondaryColor}>
          <Input
            name="secondaryColor"
            placeholder="#FFFFFF"
            maxLength={7}
            defaultValue={club.secondary_color ?? ""}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {d.save}
      </Button>
    </form>
  );
}

export interface SubscriptionValues {
  plan_id: string | null;
  license_seats: number;
  max_teams: number | null;
  modules: string[];
  starts_on: string;
  ends_on: string | null;
}

export function SubscriptionForm({
  clubId,
  subscription,
  plans,
}: {
  clubId: string;
  subscription: SubscriptionValues | null;
  plans: {
    id: string;
    name: string;
    modules: string[];
    max_coaches: number | null;
    max_teams: number | null;
  }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    setSubscription.bind(null, clubId),
    {},
  );
  const [modules, setModules] = useState(new Set(subscription?.modules ?? []));
  const s = m.subscription;
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-600">{s.intro}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={s.plan}>
          <select
            name="planId"
            defaultValue={subscription?.plan_id ?? ""}
            className={selectClass}
            onChange={(ev) => {
              // A new plan brings its modules.
              const plan = plans.find((p) => p.id === ev.target.value);
              if (plan) setModules(new Set(plan.modules));
            }}
          >
            <option value="">{s.noPlan}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={s.seats}>
          <Input
            name="seats"
            type="number"
            min={0}
            max={1000}
            required
            defaultValue={subscription?.license_seats ?? 0}
          />
        </Field>
        <Field label={s.maxTeams} hint={s.maxTeamsHint}>
          <Input
            name="maxTeams"
            type="number"
            min={0}
            max={1000}
            defaultValue={subscription?.max_teams ?? ""}
          />
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          {s.modules}
        </legend>
        <div className="flex flex-wrap gap-2">
          {CLUB_MODULES.map((code) => (
            <label
              key={code}
              className={`flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ${modules.has(code) ? "bg-brand/15 ring-brand" : "bg-slate-50 ring-slate-200"}`}
            >
              <input
                type="checkbox"
                name="modules"
                value={code}
                checked={modules.has(code)}
                onChange={(ev) => {
                  const next = new Set(modules);
                  if (ev.target.checked) next.add(code);
                  else next.delete(code);
                  setModules(next);
                }}
              />
              {m.modules[code]}
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500">{s.modulesHint}</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.startsOn}>
          <Input
            name="startsOn"
            type="date"
            defaultValue={subscription?.starts_on ?? ""}
          />
        </Field>
        <Field label={s.endsOn} hint={s.endsOnHint}>
          <Input
            name="endsOn"
            type="date"
            defaultValue={subscription?.ends_on ?? ""}
          />
        </Field>
      </div>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {s.save}
      </Button>
    </form>
  );
}
