"use client";

import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { addCard, removeCard } from "@/lib/players/card-actions";
import type { Card } from "@/lib/players/cards";

const m = messages.cards;
const COLORS: Record<Card, string> = { yellow: "#facc15", red: "#dc2626" };

/** The yellow and red cards of one match: add or remove per player. */
export function MatchCards({
  teamId,
  matchDate,
  players,
  initial,
  canEdit,
}: {
  teamId: string;
  matchDate: string;
  players: { id: string; label: string }[];
  initial: { id: string; playerId: string; card: Card }[];
  canEdit: boolean;
}) {
  const [cards, setCards] = useState(initial);
  const [player, setPlayer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = (id: string) => players.find((p) => p.id === id)?.label ?? "?";

  function add(card: Card) {
    if (!player) return;
    setError(null);
    startTransition(async () => {
      const result = await addCard(teamId, player, matchDate, card);
      if (result.card) setCards((c) => [...c, result.card!]);
      if (result.error) setError(result.error);
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCard(teamId, id, matchDate);
      if (result.error) setError(result.error);
      else setCards((c) => c.filter((x) => x.id !== id));
    });
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <div>
        <p className="text-sm font-medium text-slate-700">{m.title}</p>
        <p className="text-xs text-slate-500">{m.hint}</p>
      </div>
      {cards.length ? (
        <ul className="flex flex-wrap gap-2">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5 rounded-full bg-white py-1 pr-1.5 pl-2 text-sm ring-1 ring-slate-200">
              <span aria-hidden className="inline-block h-3.5 w-2.5 rounded-[2px]" style={{ backgroundColor: COLORS[c.card] }} />
              <span>{label(c.playerId)}</span>
              <span className="sr-only">{m[c.card]}</span>
              {canEdit && (
                <button type="button" onClick={() => remove(c.id)} disabled={pending} aria-label={m.remove} className="rounded-full px-1 text-slate-400 hover:text-red-600">
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">{m.none}</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={player}
            onChange={(event) => setPlayer(event.target.value)}
            aria-label={m.player}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">{m.choose}</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {(["yellow", "red"] as const).map((card) => (
            <button
              key={card}
              type="button"
              onClick={() => add(card)}
              disabled={!player || pending}
              className="flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-50"
            >
              <span aria-hidden className="inline-block h-3.5 w-2.5 rounded-[2px]" style={{ backgroundColor: COLORS[card] }} />
              {m[card]}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
