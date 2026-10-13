"use client";

import { startTransition } from "react";

import { messages } from "@/lib/messages";
import { PLAYER_STATUSES, type PlayerStatus } from "@/lib/players/validation";

import { setPlayerStatus } from "./actions";

const STYLES: Record<PlayerStatus, string> = {
  available: "bg-green-50 text-green-800 ring-green-200",
  injured: "bg-red-50 text-red-800 ring-red-200",
  suspended: "bg-amber-50 text-amber-800 ring-amber-200",
  unavailable: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ status }: { status: PlayerStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STYLES[status]}`}>
      {messages.players.status[status]}
    </span>
  );
}

export function StatusSelect({
  teamId,
  playerId,
  status,
}: {
  teamId: string;
  playerId: string;
  status: PlayerStatus;
}) {
  return (
    <select
      aria-label={messages.players.form.status}
      defaultValue={status}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("teamId", teamId);
        formData.set("playerId", playerId);
        formData.set("status", event.target.value);
        startTransition(() => setPlayerStatus(formData));
      }}
      className={`rounded-full border-0 py-0.5 pr-7 pl-2 text-xs font-medium ring-1 ${STYLES[status]}`}
    >
      {PLAYER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {messages.players.status[s]}
        </option>
      ))}
    </select>
  );
}
