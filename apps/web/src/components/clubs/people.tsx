"use client";

import { CLUB_PERSON_ROLES, CLUB_PERSON_TEAM_ROLES, type ClubPersonRole } from "@iassistent/db";
import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import type { FormAction, FormState } from "@/lib/clubs/form-state";
import { hasErrors } from "@/lib/clubs/import";
import { messages } from "@/lib/messages";
import type { FileState } from "@/lib/clubs/people-actions";

import { ConfirmButton, CopyButton, selectClass } from "./forms";

const m = messages.clubPeople;
const x = m.file;

/** Invite one person: name, e-mail, role and (for trainers and coordinators) a team. */
export function InviteForm({
  action: submit,
  teams,
}: {
  action: FormAction<FormState>;
  teams: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submit, {});
  const [role, setRole] = useState<ClubPersonRole>("head_coach");
  const withTeam = CLUB_PERSON_TEAM_ROLES.includes(role);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={m.invite.name}>
          <Input name="name" maxLength={120} />
        </Field>
        <Field label={m.invite.email}>
          <Input name="email" type="email" required maxLength={200} />
        </Field>
        <Field label={m.invite.role}>
          <select
            name="role"
            value={role}
            onChange={(ev) => setRole(ev.target.value as ClubPersonRole)}
            className={selectClass}
          >
            {CLUB_PERSON_ROLES.map((r) => (
              <option key={r} value={r}>
                {m.roles[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={m.invite.team}>
          <select name="team" disabled={!withTeam} defaultValue="" className={selectClass}>
            <option value="">{m.invite.noTeam}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        {m.roleHints[role]} {withTeam ? m.invite.teamHint : ""}
      </p>
      <Button type="submit" disabled={pending}>
        {m.invite.submit}
      </Button>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
    </form>
  );
}

/** Copy the invitation text with the sign-up link. */
export function InvitationCopy({ clubName, email }: { clubName: string; email: string }) {
  const link = typeof window === "undefined" ? "/signup" : `${window.location.origin}/signup`;
  return <CopyButton text={m.invitations.text(clubName, email, link)} label={m.invitations.copy} />;
}

/** Withdraw a pending invitation (form with confirmation). */
export function InvitationRevoke({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <ConfirmButton label={m.invitations.revoke} confirmText={m.invitations.revokeConfirm} />
    </form>
  );
}

/** The club file: download, upload, check (nothing saved), then import with the same file. */
export function ClubFileImport({
  templateHref,
  check: checkAction,
  run: runAction,
}: {
  templateHref: string;
  check: FormAction<FileState>;
  run: FormAction<FileState>;
}) {
  const [checked, check, checking] = useActionState<FileState, FormData>(checkAction, {});
  const [imported, run, running] = useActionState<FileState, FormData>(runAction, {});
  const preview = checked.preview;
  const done = imported.done;
  const error = imported.error ?? checked.error;
  const ready = preview && !hasErrors(preview.data) && !preview.blocker;
  const existing = new Set((preview?.existingTeams ?? []).map((t) => t.toLowerCase()));
  const categories = messages.ageCategories as Record<string, string>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{x.intro}</p>
      <a
        href={templateHref}
        className="inline-block rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-200"
      >
        {x.download}
      </a>

      <form action={check} className="flex flex-wrap items-end gap-3">
        <Field label={x.upload}>
          <input name="file" type="file" accept=".xlsx" required className="block text-sm" />
        </Field>
        <Button type="submit" variant="secondary" disabled={checking || running}>
          {checking ? x.busy : x.check}
        </Button>
        {ready && !done && (
          <Button type="submit" formAction={run} disabled={checking || running}>
            {running ? x.busy : x.import}
          </Button>
        )}
      </form>

      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}

      {preview && !done && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h3 className="font-semibold">{x.preview}</h3>
          <p className="text-sm text-slate-700">{x.seats(preview.seatsNeeded, preview.seatsFree)}</p>
          {preview.seatsNeeded > preview.seatsFree && (
            <Alert tone="error">{x.notEnoughSeats}</Alert>
          )}
          {preview.blocker && <Alert tone="error">{preview.blocker}</Alert>}
          {hasErrors(preview.data) && <Alert tone="error">{x.fixErrors}</Alert>}

          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">{x.sheets.teams}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.category}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.federationTeam}</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {preview.data.teams.map((t) => (
                <tr key={t.line}>
                  <td className="py-1.5 pr-3">{t.name || "—"}</td>
                  <td className="py-1.5 pr-3">{t.category ? categories[t.category] : "—"}</td>
                  <td className="py-1.5 pr-3">{t.federationTeam || "—"}</td>
                  <td className="py-1.5 text-xs">
                    {t.errors.length ? (
                      <span className="text-red-700">
                        {x.line(x.sheets.teams, t.line)}: {t.errors.join(" ")}
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {existing.has(t.name.toLowerCase()) ? x.existingTeam : x.newTeam}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-1 pr-3 font-medium">{x.sheets.people}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.email}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.role}</th>
                <th className="py-1 pr-3 font-medium">{x.columns.team}</th>
                <th className="py-1 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {preview.data.people.map((p) => (
                <tr key={p.line}>
                  <td className="py-1.5 pr-3">{p.name || "—"}</td>
                  <td className="py-1.5 pr-3">{p.email || "—"}</td>
                  <td className="py-1.5 pr-3">{p.role ? m.roles[p.role] : "—"}</td>
                  <td className="py-1.5 pr-3">{p.team || "—"}</td>
                  <td className="py-1.5 text-xs text-red-700">
                    {p.errors.length ? `${x.line(x.sheets.people, p.line)}: ${p.errors.join(" ")}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
