"use client";

import Link from "next/link";
import { useActionState } from "react";

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
  clubs: { id: string; name: string }[];
  pending: { id: string; clubName: string } | null;
}) {
  const [state, action, busy] = useActionState<FormState, FormData>(
    requestLink.bind(null, teamId),
    {},
  );
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
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label={m.club}>
        <select name="clubId" required className={selectClass}>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Button type="submit" disabled={busy} variant="secondary">
        {m.request}
      </Button>
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
