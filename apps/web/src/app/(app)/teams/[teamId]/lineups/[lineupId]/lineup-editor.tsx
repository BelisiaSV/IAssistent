"use client";

import type { Enums } from "@iassistent/db";
import type { FormationCatalog, FormationSlot, PositionCatalog } from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState, useMemo, useState } from "react";

import { Pitch } from "@/components/pitch";
import { readableOn } from "@/lib/proposals/overview";
import { Alert, Button, Field, Input } from "@/components/ui";
import {
  assignToSlot,
  changeFormation,
  clearSlot,
  type LineupState,
  moveToBench,
  removeFromLineup,
} from "@/lib/lineups/state";
import { messages } from "@/lib/messages";

import { type LineupFormState, saveLineup } from "../actions";

const m = messages.lineups;
const pm = messages.players;

export interface LineupPlayer {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  primaryPosition: string | null;
  secondaryPositions: string[];
  preferredFoot: Enums<"preferred_foot"> | null;
  status: Enums<"player_status">;
  archived: boolean;
}

export interface LineupDetails {
  title: string;
  matchDate: string;
  opponent: string;
}

export function LineupEditor({
  teamId,
  lineupId,
  details,
  initial,
  players,
  formations,
  positions,
  colors,
  canEdit,
}: {
  teamId: string;
  lineupId: string;
  details: LineupDetails;
  initial: LineupState;
  players: LineupPlayer[];
  formations: FormationCatalog;
  positions: PositionCatalog;
  colors: { primary: string; secondary: string };
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<LineupFormState, FormData>(
    saveLineup.bind(null, teamId, lineupId),
    {},
  );
  const [lineup, setLineup] = useState<LineupState>(initial);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const formation =
    formations.formaties.find((f) => f.code === lineup.formation) ?? formations.formaties[0]!;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const slot = formation.posten.find((s) => s.id === selectedSlot) ?? null;

  function update(next: LineupState) {
    setLineup(next);
    setDirty(true);
  }

  function pickPlayer(playerId: string) {
    if (!canEdit || !slot) return;
    update(assignToSlot(lineup, slot.id, playerId));
    // Jump to the next empty slot for fast picking.
    const next = formation.posten.find((s) => s.id !== slot.id && !lineup.starters[s.id]);
    setSelectedSlot(next?.id ?? null);
  }

  const selectedIds = new Set([...Object.values(lineup.starters), ...lineup.bench]);
  const lineOrder = new Map(positions.linies.map((l, i) => [l.id, i]));
  const lineOf = (code: string | null) =>
    positions.posities.find((p) => p.code === code)?.linie ?? "";
  const fits = (p: LineupPlayer) =>
    !!slot && (p.primaryPosition === slot.positie || p.secondaryPositions.includes(slot.positie));

  const pool = players
    .filter((p) => !selectedIds.has(p.id) && !p.archived)
    .sort(
      (a, b) =>
        Number(fits(b)) - Number(fits(a)) ||
        Number(b.status === "available") - Number(a.status === "available") ||
        (lineOrder.get(lineOf(a.primaryPosition)) ?? 99) - (lineOrder.get(lineOf(b.primaryPosition)) ?? 99) ||
        (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999),
    );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("formation", lineup.formation);
    formData.set("players", JSON.stringify({ starters: lineup.starters, bench: lineup.bench }));
    startTransition(() => action(formData));
    setDirty(false);
  }

  const errors = state.fieldErrors ?? {};
  const starterCount = Object.keys(lineup.starters).length;

  return (
    <form onSubmit={onSubmit} onChange={() => setDirty(true)} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && !dirty && <Alert tone="success">{state.success}</Alert>}

      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-4">
        <Field label={m.titleLabel} error={errors.title}>
          <Input name="title" required maxLength={120} defaultValue={details.title} disabled={!canEdit} />
        </Field>
        <Field label={m.opponent} error={errors.opponent}>
          <Input name="opponent" maxLength={120} defaultValue={details.opponent} disabled={!canEdit} />
        </Field>
        <Field label={m.matchDate} error={errors.matchDate}>
          <Input name="matchDate" type="date" defaultValue={details.matchDate} disabled={!canEdit} />
        </Field>
        <Field label={m.formation} error={errors.formation}>
          <select
            value={lineup.formation}
            disabled={!canEdit}
            onChange={(e) => {
              const to = formations.formaties.find((f) => f.code === e.target.value);
              if (to) update(changeFormation(lineup, formation, to));
              setSelectedSlot(null);
            }}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            {formations.formaties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.naam}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">
              {m.selectedCount(starterCount, formation.posten.length, lineup.bench.length)}
            </p>
            {canEdit && (
              <p className={`rounded-full px-3 py-1 text-xs font-medium ${slot ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                {slot ? m.pickedSlot(slot.id) : m.pickSlot}
              </p>
            )}
          </div>
          <Pitch>
            {formation.posten.map((s) => (
              <SlotMarker
                key={s.id}
                slot={s}
                player={lineup.starters[s.id] ? byId.get(lineup.starters[s.id]!) : undefined}
                selected={selectedSlot === s.id}
                colors={colors}
                canEdit={canEdit}
                onSelect={() => setSelectedSlot(selectedSlot === s.id ? null : s.id)}
                onClear={() => update(clearSlot(lineup, s.id))}
              />
            ))}
          </Pitch>
        </div>

        <div className="space-y-5">
          <PlayerList
            title={`${m.bench} (${lineup.bench.length})`}
            players={lineup.bench.map((id) => byId.get(id)).filter((p): p is LineupPlayer => !!p)}
            color={colors.primary}
            canEdit={canEdit}
            highlight={fits}
            onPick={slot ? pickPlayer : undefined}
            actions={(p) => (
              <SmallButton onClick={() => update(removeFromLineup(lineup, p.id))}>
                {m.removeFromLineup}
              </SmallButton>
            )}
          />
          <PlayerList
            title={`${m.notSelected} (${pool.length})`}
            players={pool}
            color="#475569"
            canEdit={canEdit}
            highlight={fits}
            onPick={slot ? pickPlayer : undefined}
            actions={(p) => (
              <SmallButton onClick={() => update(moveToBench(lineup, p.id))}>{m.toBench}</SmallButton>
            )}
          />
        </div>
      </div>

      {canEdit && (
        <div className="sticky bottom-4 flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="rounded-lg px-5 shadow-lg"
            style={{ backgroundColor: colors.primary, color: readableOn(colors.primary) }}
          >
            {pending ? messages.common.saving : messages.common.save}
          </Button>
        </div>
      )}
    </form>
  );
}

function SlotMarker({
  slot,
  player,
  selected,
  colors,
  canEdit,
  onSelect,
  onClear,
}: {
  slot: FormationSlot;
  player: LineupPlayer | undefined;
  selected: boolean;
  colors: { primary: string; secondary: string };
  canEdit: boolean;
  onSelect: () => void;
  onClear: () => void;
}) {
  const unavailable = player && player.status !== "available";
  return (
    <div
      className="absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      <button
        type="button"
        disabled={!canEdit}
        onClick={onSelect}
        title={unavailable ? `${m.unavailableWarning}: ${pm.status[player.status]}` : undefined}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full text-base font-bold transition ${
          player ? "shadow-md" : "border-2 border-dashed border-white/40 text-white/60"
        } ${selected ? "ring-4 ring-amber-300" : ""} ${canEdit ? "cursor-pointer hover:scale-105" : ""}`}
        style={player ? { backgroundColor: colors.primary, color: colors.secondary } : undefined}
      >
        {player ? (player.shirtNumber ?? "–") : slot.id}
        {player?.preferredFoot && (
          <span className="absolute -top-1 -left-1 rounded-full bg-slate-900 px-1 text-[10px] font-semibold text-white ring-1 ring-white/40">
            {pm.footShort[player.preferredFoot]}
          </span>
        )}
        {unavailable && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-[#13232f]" />
        )}
      </button>
      <span className="text-[10px] font-medium text-white/60">{slot.id}</span>
      {player && (
        <span className="flex max-w-full items-center gap-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-xs font-medium text-white">
          <span className="truncate">
            {player.firstName.charAt(0)}. {player.lastName}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={onClear}
              aria-label={m.removeFromLineup}
              className="text-white/60 hover:text-white"
            >
              ×
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function PlayerList({
  title,
  players,
  color,
  canEdit,
  highlight,
  onPick,
  actions,
}: {
  title: string;
  players: LineupPlayer[];
  color: string;
  canEdit: boolean;
  highlight: (p: LineupPlayer) => boolean;
  onPick?: (playerId: string) => void;
  actions: (p: LineupPlayer) => React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{title}</h3>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {players.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 px-3 py-2 ${highlight(p) ? "bg-amber-50" : ""}`}>
            <button
              type="button"
              disabled={!canEdit || !onPick}
              onClick={() => onPick?.(p.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left enabled:hover:text-brand"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums"
                style={{ backgroundColor: color, color: readableOn(color) }}
              >
                {p.shirtNumber ?? "–"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {p.firstName} {p.lastName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {[p.primaryPosition, ...p.secondaryPositions].filter(Boolean).join(" · ")}
                  {p.status !== "available" && (
                    <span className="text-red-700"> · {pm.status[p.status]}</span>
                  )}
                </span>
              </span>
            </button>
            {canEdit && actions(p)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
