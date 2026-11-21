"use client";

import { CLUB_ROLES, TEAM_STAFF_ROLES } from "@iassistent/db";
import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import type { CodeState, FormAction, FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.clubAdmin;
export const selectClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

export function CopyButton({ text, label }: { text: string; label?: string }) {
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
      {copied ? m.codes.copied : (label ?? m.codes.copy)}
    </button>
  );
}

/** A code just made: shown once, with buttons to copy it or an invitation with a link that fills it in. */
export function CodeReveal({
  code,
  clubName,
  label,
}: {
  code: string;
  clubName: string;
  label: string;
}) {
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/clubs/join?code=${encodeURIComponent(code)}`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
      <span className="text-sm text-emerald-700">{label}</span>
      <code className="rounded bg-white px-2 py-1 font-mono text-lg font-bold tracking-wider text-slate-900 select-all">
        {code}
      </code>
      <CopyButton text={code} />
      <CopyButton
        text={m.codes.invite(clubName, code, link)}
        label={m.codes.copyInvite}
      />
    </div>
  );
}

/** Replace an open code that got lost by a new one (same role, team and note); the new code is shown once. */
export function ReissueButton({
  codeId,
  clubName,
  action: submit,
}: {
  codeId: string;
  clubName: string;
  action: FormAction<CodeState>;
}) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    submit,
    {},
  );
  if (state.code)
    return (
      <CodeReveal
        code={state.code}
        clubName={clubName}
        label={m.codes.reissued}
      />
    );
  return (
    <form action={action} className="inline">
      <input type="hidden" name="codeId" value={codeId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(ev) => {
          if (!confirm(m.codes.reissueConfirm)) ev.preventDefault();
        }}
        className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
      >
        {m.codes.reissue}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}

/**
 * Make one activation code. `roles` limits the roles on offer (a club admin
 * cannot make owner or admin codes); the database checks it again.
 */
export function CodeForm({
  action: submit,
  teams,
  clubName,
  roles = CLUB_ROLES,
}: {
  action: FormAction<CodeState>;
  /** For the invitation text. */
  clubName: string;
  teams: { id: string; name: string }[];
  roles?: readonly (typeof CLUB_ROLES)[number][];
}) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    submit,
    {},
  );
  const [teamId, setTeamId] = useState("");
  const c = m.codes;
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-600">
        {c.intro} {c.lostHint}
      </p>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={c.role}>
          <select name="role" defaultValue="coach" className={selectClass}>
            {roles.map((r) => (
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
        <CodeReveal code={state.code} clubName={clubName} label={c.newCode} />
      )}
      <Button type="submit" disabled={pending}>
        {c.create}
      </Button>
    </form>
  );
}

export function TeamForm({
  action: submit,
}: {
  action: FormAction<FormState>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submit,
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

/** Put a person of the club on a team's staff. */
export function StaffForm({
  action: submit,
  teams,
  people,
}: {
  action: FormAction<FormState>;
  teams: { id: string; name: string }[];
  people: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submit,
    {},
  );
  const s = messages.club.structure;
  return (
    <form
      action={action}
      className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_12rem_auto]"
    >
      <Field label={s.person}>
        <select name="coachId" required className={selectClass}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={s.team}>
        <select name="teamId" required className={selectClass}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={s.teamRole}>
        <select name="role" defaultValue="head_coach" className={selectClass}>
          {TEAM_STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {m.teamRoles[r]}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" disabled={pending} variant="secondary">
        {s.add}
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
  tone = "danger",
}: {
  label: string;
  confirmText: string;
  tone?: "danger" | "primary";
}) {
  return (
    <button
      type="submit"
      onClick={(ev) => {
        if (!confirm(confirmText)) ev.preventDefault();
      }}
      className={`text-sm font-medium hover:underline ${tone === "danger" ? "text-red-700" : "text-brand"}`}
    >
      {label}
    </button>
  );
}
