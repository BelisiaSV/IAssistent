"use client";

import { CLUB_MODULES, CLUB_ROLES, TEAM_STAFF_ROLES } from "@iassistent/db";
import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import {
  type CodeState,
  createCode,
  createTeam,
  type FormState,
  setSubscription,
  updateClub,
} from "../actions";

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

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-sm font-medium text-brand hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? m.codes.copied : m.codes.copy}
    </button>
  );
}

export function CodeForm({
  clubId,
  teams,
}: {
  clubId: string;
  teams: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    createCode.bind(null, clubId),
    {},
  );
  const [teamId, setTeamId] = useState("");
  const c = m.codes;
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-600">{c.intro}</p>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={c.role}>
          <select name="role" defaultValue="coach" className={selectClass}>
            {CLUB_ROLES.map((r) => (
              <option key={r} value={r}>
                {m.roles[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.team}>
          <select
            name="teamId"
            value={teamId}
            onChange={(ev) => setTeamId(ev.target.value)}
            className={selectClass}
          >
            <option value="">{c.noTeam}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.teamRole}>
          <select
            name="teamRole"
            defaultValue="head_coach"
            disabled={!teamId}
            className={selectClass}
          >
            {TEAM_STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {m.teamRoles[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.expires}>
          <Input name="expires" type="date" />
        </Field>
      </div>
      <Field label={c.note}>
        <Input name="note" maxLength={120} />
      </Field>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.code && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
          <span className="text-sm text-emerald-900">{c.newCode}</span>
          <code className="rounded bg-white px-2 py-1 font-mono text-lg font-bold tracking-wider text-slate-900">
            {state.code}
          </code>
          <CopyButton text={state.code} />
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {c.create}
      </Button>
    </form>
  );
}

export function TeamForm({ clubId }: { clubId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createTeam.bind(null, clubId),
    {},
  );
  const t = m.teams;
  return (
    <form
      action={action}
      className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_8rem_auto]"
    >
      <Field label={t.name}>
        <Input name="name" required maxLength={120} />
      </Field>
      <Field label={t.category}>
        <select name="category" defaultValue="senioren" className={selectClass}>
          {AGE_CATEGORIES.map((a) => (
            <option key={a} value={a}>
              {(messages.ageCategories as Record<string, string>)[a]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.season}>
        <Input name="season" maxLength={20} placeholder="2026-2027" />
      </Field>
      <Button type="submit" disabled={pending} variant="secondary">
        {t.create}
      </Button>
      {state.error && (
        <div className="sm:col-span-4">
          <Alert tone="error">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}

/** A submit button that asks first. */
export function ConfirmButton({
  label,
  confirmText,
}: {
  label: string;
  confirmText: string;
}) {
  return (
    <button
      type="submit"
      onClick={(ev) => {
        if (!confirm(confirmText)) ev.preventDefault();
      }}
      className="text-sm font-medium text-red-700 hover:underline"
    >
      {label}
    </button>
  );
}
