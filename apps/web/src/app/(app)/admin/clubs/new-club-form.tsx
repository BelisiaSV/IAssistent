"use client";

import { useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { createClub, type FormState } from "./actions";

const m = messages.clubAdmin.newClub;
const selectClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";

type Option = { number: string; name: string; teams: number; made: boolean };

/** Pick a club from the federation export (fills name and number) and create it. */
export function NewClubForm({ options }: { options: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createClub,
    {},
  );
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  return (
    <form action={action} className="space-y-4">
      {options.length ? (
        <Field label={m.pick}>
          <select
            className={selectClass}
            value={number}
            onChange={(ev) => {
              const club = options.find((o) => o.number === ev.target.value);
              setNumber(ev.target.value);
              if (club) setName(club.name);
            }}
          >
            <option value="">{m.pickPlaceholder}</option>
            {options.map((o) => (
              <option key={o.number} value={o.number} disabled={o.made}>
                {o.name} · {o.number}
                {o.made ? ` (${m.alreadyMade})` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-sm text-slate-600">{m.noFederation}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <Field label={m.name}>
          <Input
            name="name"
            required
            maxLength={120}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
          />
        </Field>
        <Field label={m.number}>
          <Input
            name="number"
            maxLength={10}
            value={number}
            onChange={(ev) => setNumber(ev.target.value)}
          />
        </Field>
      </div>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {m.create}
      </Button>
    </form>
  );
}
