"use client";

import type { FormationCatalog } from "@iassistent/staff-engine/content";
import { type FormEvent, startTransition, useActionState, useState } from "react";

import { Pitch } from "@/components/pitch";
import { Alert, Button, Field, Input } from "@/components/ui";
import { messages } from "@/lib/messages";

import { type OpponentFormState, saveOpponentLineup } from "../actions";

const m = messages.opponents;
const cellClass = "rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50";

type Entry = { number: string; name: string };
const empty = (): Entry => ({ number: "", name: "" });
const MAX_BENCH = 12;

/**
 * Lineup of the opponent: shirt number + name per slot of a formation, and the
 * bench. Only the shirt numbers and slots go to the staff.
 */
export function OpponentLineupEditor({
  teamId,
  opponentId,
  formations,
  initial,
  canEdit,
}: {
  teamId: string;
  opponentId: string;
  formations: FormationCatalog;
  initial: {
    formation: string;
    matchDate: string | null;
    starters: Record<string, { number: number | null; name: string }>;
    bench: { number: number | null; name: string }[];
  } | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<OpponentFormState, FormData>(
    saveOpponentLineup.bind(null, teamId, opponentId),
    {},
  );
  const toEntry = (p: { number: number | null; name: string }): Entry => ({
    number: p.number === null ? "" : String(p.number),
    name: p.name,
  });
  const [formationCode, setFormationCode] = useState(initial?.formation ?? formations.formaties[0]!.code);
  const [matchDate, setMatchDate] = useState(initial?.matchDate ?? "");
  const [starters, setStarters] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(Object.entries(initial?.starters ?? {}).map(([slot, p]) => [slot, toEntry(p)])),
  );
  const [bench, setBench] = useState<Entry[]>(() => {
    const list = (initial?.bench ?? []).map(toEntry);
    return list.length ? list : Array.from({ length: 5 }, empty);
  });

  const formation = formations.formaties.find((f) => f.code === formationCode) ?? formations.formaties[0]!;

  function changeFormation(code: string) {
    const next = formations.formaties.find((f) => f.code === code);
    if (!next) return;
    const ids = new Set(next.posten.map((s) => s.id));
    const kept: Record<string, Entry> = {};
    const displaced: { position: string | undefined; entry: Entry }[] = [];
    for (const [slot, entry] of Object.entries(starters)) {
      if (ids.has(slot)) kept[slot] = entry;
      else displaced.push({ position: formation.posten.find((s) => s.id === slot)?.positie, entry });
    }
    for (const { position, entry } of displaced) {
      const free = next.posten.find((s) => s.positie === position && !kept[s.id]) ?? next.posten.find((s) => !kept[s.id]);
      if (free) kept[free.id] = entry;
    }
    setFormationCode(code);
    setStarters(kept);
  }

  const setSlot = (slot: string, patch: Partial<Entry>) =>
    setStarters((s) => ({ ...s, [slot]: { ...(s[slot] ?? empty()), ...patch } }));
  const setBenchEntry = (i: number, patch: Partial<Entry>) =>
    setBench((b) => b.map((entry, j) => (j === i ? { ...entry, ...patch } : entry)));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toPlayer = (e: Entry) => ({ number: e.number === "" ? null : Number(e.number), name: e.name.trim() });
    const formData = new FormData();
    formData.set("matchDate", matchDate);
    formData.set(
      "lineup",
      JSON.stringify({
        formation: formation.code,
        starters: Object.fromEntries(Object.entries(starters).map(([slot, e]) => [slot, toPlayer(e)])),
        bench: bench.map(toPlayer),
      }),
    );
    startTransition(() => action(formData));
  }

  const numberInput = (value: string, onChange: (v: string) => void, id?: string, label?: string) => (
    <input
      id={id}
      type="number"
      min={1}
      max={99}
      inputMode="numeric"
      aria-label={label ?? m.number}
      placeholder={m.number}
      value={value}
      disabled={!canEdit}
      onChange={(e) => onChange(e.target.value)}
      className={`w-16 ${cellClass}`}
    />
  );
  const nameInput = (value: string, onChange: (v: string) => void, label: string) => (
    <input
      aria-label={label}
      placeholder={m.playerName}
      value={value}
      maxLength={80}
      disabled={!canEdit}
      onChange={(e) => onChange(e.target.value)}
      className={`min-w-0 flex-1 ${cellClass}`}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">{m.lineup}</h2>
        <p className="text-sm text-slate-600">{m.lineupHint}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.formation}>
          <select
            value={formation.code}
            disabled={!canEdit}
            onChange={(e) => changeFormation(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            {formations.formaties.map((f) => (
              <option key={f.code} value={f.code}>
                {f.naam}
              </option>
            ))}
          </select>
        </Field>
        <Field label={m.matchDate}>
          <Input type="date" value={matchDate} disabled={!canEdit} onChange={(e) => setMatchDate(e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <Pitch>
          {formation.posten.map((slot) => {
            const entry = starters[slot.id];
            return (
              <label
                key={slot.id}
                htmlFor={`slot-${slot.id}`}
                className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                    entry?.number ? "bg-[#eb6834] text-white shadow" : "border-2 border-dashed border-white/40 text-white/60"
                  }`}
                >
                  {entry?.number || slot.id}
                </span>
                {entry?.name && (
                  <span className="mt-0.5 max-w-full truncate rounded bg-black/50 px-1 text-[10px] text-white">{entry.name}</span>
                )}
              </label>
            );
          })}
        </Pitch>

        <div className="space-y-4">
          <ul className="space-y-1.5">
            {formation.posten.map((slot) => {
              const entry = starters[slot.id] ?? empty();
              return (
                <li key={slot.id} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-xs text-slate-500">{slot.id}</span>
                  {numberInput(entry.number, (v) => setSlot(slot.id, { number: v }), `slot-${slot.id}`, `${slot.id} ${m.number}`)}
                  {nameInput(entry.name, (v) => setSlot(slot.id, { name: v }), `${slot.id} ${m.playerName}`)}
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{m.bench}</p>
            {bench.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-slate-500">{i + 1}</span>
                {numberInput(entry.number, (v) => setBenchEntry(i, { number: v }), undefined, `${m.bench} ${i + 1} ${m.number}`)}
                {nameInput(entry.name, (v) => setBenchEntry(i, { name: v }), `${m.bench} ${i + 1} ${m.playerName}`)}
              </div>
            ))}
            {canEdit && bench.length < MAX_BENCH && (
              <button type="button" onClick={() => setBench((b) => [...b, empty()])} className="text-sm text-brand hover:underline">
                + {m.addBench}
              </button>
            )}
          </div>
        </div>
      </div>

      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {canEdit && (
        <div className="text-right">
          <Button type="submit" disabled={pending}>
            {pending ? messages.common.saving : m.saveLineup}
          </Button>
        </div>
      )}
    </form>
  );
}
