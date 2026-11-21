"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { selectClass } from "@/components/clubs/forms";
import { Alert, Button, Field } from "@/components/ui";
import { cancelLink, requestLink } from "@/lib/clubs/actions";
import type { FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";

const m = messages.club.link;

export function ClubLinkForm({
  teamId,
  clubs,
  pending,
}: {
  teamId: string;
  clubs: { id: string; name: string; federationTeams: string[] }[];
  pending: { id: string; clubName: string } | null;
}) {
  const [state, action, busy] = useActionState<FormState, FormData>(
    requestLink.bind(null, teamId),
    {},
  );
  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const federationTeams =
    clubs.find((c) => c.id === clubId)?.federationTeams ?? [];
  if (pending) {
    return (
      <form
        action={cancelLink}
        className="flex flex-wrap items-center gap-3 text-sm"
      >
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="linkId" value={pending.id} />
        <span>{m.pending(pending.clubName)}</span>
        <button
          type="submit"
          className="font-medium text-red-700 hover:underline"
        >
          {m.cancel}
        </button>
      </form>
    );
  }
  if (!clubs.length) {
    return (
      <p className="text-sm text-slate-600">
        {m.noClubs}{" "}
        <Link
          href="/clubs/join"
          className="font-medium text-brand hover:underline"
        >
          {messages.club.nav.join} →
        </Link>
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={m.club}>
          <select
            name="clubId"
            required
            className={selectClass}
            value={clubId}
            onChange={(event) => setClubId(event.target.value)}
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {federationTeams.length > 0 && (
          <Field label={m.federationTeam}>
            <select
              key={clubId}
              name="federationTeam"
              defaultValue=""
              className={selectClass}
            >
              <option value="">{m.federationNone}</option>
              {federationTeams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Button type="submit" disabled={busy} variant="secondary">
          {m.request}
        </Button>
      </div>
      {federationTeams.length > 0 && (
        <p className="text-xs text-slate-500">{m.federationHint}</p>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
