"use client";

import type { Tables } from "@iassistent/db";
import type { PositionCatalog } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";
import { PLAYER_STATUSES, PREFERRED_FEET } from "@/lib/players/validation";
import { currentSeasonStartYear, formatSeason } from "@/lib/season";

import { archivePlayer, type PlayerFormState, savePlayer } from "./actions";

const m = messages.players;
const f = m.form;

const selectClass =
  "block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none";

export function PlayerForm({
  teamId,
  player,
  positions,
}: {
  teamId: string;
  player?: Tables<"players">;
  positions: PositionCatalog;
}) {
  const [state, action, pending] = useActionState<PlayerFormState, FormData>(
    savePlayer.bind(null, teamId, player?.id ?? null),
    {},
  );
  const [status, setStatus] = useState<string>(player?.status ?? "available");
  const errors = state.fieldErrors ?? {};

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  const thisSeason = currentSeasonStartYear();
  const seasons = Array.from({ length: 30 }, (_, i) => thisSeason + 1 - i);

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {state.error && <Alert tone="error">{state.error}</Alert>}

        <div className="grid gap-5 sm:grid-cols-[1fr_1fr_8rem]">
          <Field label={f.firstName} error={errors.firstName}>
            <Input name="firstName" required maxLength={80} defaultValue={player?.first_name} />
          </Field>
          <Field label={f.lastName} error={errors.lastName}>
            <Input name="lastName" required maxLength={80} defaultValue={player?.last_name} />
          </Field>
          <Field label={f.shirtNumber} error={errors.shirtNumber}>
            <Input
              name="shirtNumber"
              type="number"
              min={1}
              max={99}
              defaultValue={player?.shirt_number ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.primaryPosition} error={errors.primaryPosition}>
            <select name="primaryPosition" defaultValue={player?.primary_position ?? ""} className={selectClass}>
              <option value="">{f.choose}</option>
              {positions.linies.map((line) => (
                <optgroup key={line.id} label={line.naam}>
                  {positions.posities
                    .filter((p) => p.linie === line.id)
                    .map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} – {p.naam}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label={f.preferredFoot} error={errors.preferredFoot}>
            <select name="preferredFoot" defaultValue={player?.preferred_foot ?? ""} className={selectClass}>
              <option value="">{f.choose}</option>
              {PREFERRED_FEET.map((foot) => (
                <option key={foot} value={foot}>
                  {m.foot[foot]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">{f.secondaryPositions}</legend>
          <div className="flex flex-wrap gap-2">
            {positions.posities.map((p) => (
              <label
                key={p.code}
                title={p.naam}
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-sm has-checked:border-brand has-checked:bg-brand/10"
              >
                <input
                  type="checkbox"
                  name="secondaryPositions"
                  value={p.code}
                  defaultChecked={player?.secondary_positions.includes(p.code)}
                  className="accent-brand"
                />
                {p.code}
              </label>
            ))}
          </div>
          {errors.secondaryPositions && <p className="text-xs text-red-600">{errors.secondaryPositions}</p>}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.birthYear} error={errors.birthYear}>
            <Input
              name="birthYear"
              type="number"
              min={1940}
              max={new Date().getFullYear()}
              defaultValue={player?.birth_year ?? ""}
            />
          </Field>
          <Field label={f.joinedClubYear} hint={f.joinedClubYearHint} error={errors.joinedClubYear}>
            <select name="joinedClubYear" defaultValue={player?.joined_club_year ?? ""} className={selectClass}>
              <option value="">{f.choose}</option>
              {seasons.map((year) => (
                <option key={year} value={year}>
                  {formatSeason(year)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={f.status} error={errors.status}>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClass}
            >
              {PLAYER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {m.status[s]}
                </option>
              ))}
            </select>
          </Field>
          {status === "injured" && (
            <Field label={f.expectedReturnDate} error={errors.expectedReturnDate}>
              <Input
                name="expectedReturnDate"
                type="date"
                defaultValue={player?.expected_return_date ?? ""}
              />
            </Field>
          )}
        </div>
        {status === "injured" && <p className="text-xs text-slate-500">{f.injuryPrivacy}</p>}

        <Field label={f.notes} hint={f.notesHint} error={errors.notes}>
          <textarea
            name="notes"
            maxLength={500}
            rows={3}
            defaultValue={player?.notes ?? ""}
            className={selectClass}
          />
        </Field>

        <div className="flex items-center justify-end gap-3">
          <Link href={`/teams/${teamId}/players`} className="text-sm text-slate-600 hover:text-brand">
            {messages.common.cancel}
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      </form>

      {player && !player.archived_at && (
        <form
          action={archivePlayer}
          onSubmit={(e) => {
            if (!confirm(m.archiveConfirm)) e.preventDefault();
          }}
          className="text-right"
        >
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="playerId" value={player.id} />
          <button type="submit" className="text-sm text-red-700 hover:underline">
            {m.archive}
          </button>
        </form>
      )}
    </div>
  );
}
