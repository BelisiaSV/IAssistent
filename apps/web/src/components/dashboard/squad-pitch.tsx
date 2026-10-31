"use client";

import type { FormationSlot } from "@iassistent/staff-engine/content";
import { startTransition, useState } from "react";

import { setPlayerStatus } from "@/app/(app)/teams/[teamId]/players/actions";
import { messages } from "@/lib/messages";
import { STATUS_COLORS } from "@/lib/players/status";
import { PLAYER_STATUSES, type PlayerStatus } from "@/lib/players/validation";
import { readableOn, shade } from "@/lib/proposals/overview";

const m = messages.dashboard.squad;
const pm = messages.players;
/** Players shown under a shirt; more opens the full list below the pitch. */
const MAX_ON_PITCH = 3;

export interface PitchPlayer {
  id: string;
  shirtNumber: number | null;
  firstName: string;
  lastName: string;
  status: PlayerStatus;
  expectedReturnDate: string | null;
}

/**
 * The squad on a pitch in the team formation: under each shirt the players of
 * that post with a status dot. The head coach clicks a player to change the
 * status (and the expected return after an injury).
 */
export function SquadPitch({
  teamId,
  canEdit,
  slots,
  unplaced,
  colors,
  keeperColor,
}: {
  teamId: string;
  canEdit: boolean;
  slots: { slot: FormationSlot; players: PitchPlayer[] }[];
  unplaced: PitchPlayer[];
  colors: { primary: string; secondary: string };
  keeperColor: string;
}) {
  // Changes shown right away; the page refreshes with the saved data.
  const [changed, setChanged] = useState<Record<string, Pick<PitchPlayer, "status" | "expectedReturnDate">>>({});
  const [editing, setEditing] = useState<PitchPlayer | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const openList = slots.find((s) => s.slot.id === openSlot && s.players.length > MAX_ON_PITCH) ?? null;
  const withChanges = (p: PitchPlayer): PitchPlayer => ({ ...p, ...changed[p.id] });

  function save(player: PitchPlayer, status: PlayerStatus, returnDate: string) {
    const formData = new FormData();
    formData.set("teamId", teamId);
    formData.set("playerId", player.id);
    formData.set("status", status);
    if (status === "injured") formData.set("expectedReturnDate", returnDate);
    setChanged((c) => ({ ...c, [player.id]: { status, expectedReturnDate: status === "injured" ? returnDate || null : null } }));
    setEditing(null);
    startTransition(() => setPlayerStatus(formData));
  }

  const chip = (raw: PitchPlayer) => {
    const p = withChanges(raw);
    const label = (
      <>
        <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20" style={{ backgroundColor: STATUS_COLORS[p.status] }} />
        {p.shirtNumber !== null && <span className="tabular-nums">{p.shirtNumber}</span>}
        <span className="truncate">
          {p.firstName} {p.lastName.slice(0, 1)}.
        </span>
      </>
    );
    const className = `flex max-w-full items-center gap-1 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[clamp(9px,2.3cqw,12px)] leading-tight font-semibold text-white shadow-sm ${
      p.status === "available" ? "" : "opacity-75"
    }`;
    return canEdit ? (
      <button
        key={p.id}
        type="button"
        onClick={() => setEditing(p)}
        title={pm.status[p.status]}
        className={`${className} hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none`}
      >
        {label}
      </button>
    ) : (
      <span key={p.id} title={pm.status[p.status]} className={className}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="@container relative mx-auto aspect-[68/100] w-full max-w-[clamp(400px,calc((100vh-15rem)*0.68),600px)] overflow-hidden rounded-2xl shadow-inner ring-4 ring-emerald-900/20">
        <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x="0" y={i * 10} width="68" height="10" fill={i % 2 ? "#2f8f46" : "#33994b"} />
          ))}
          <g fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.35">
            <rect x="3" y="3" width="62" height="94" />
            <line x1="3" y1="50" x2="65" y2="50" />
            <circle cx="34" cy="50" r="8" />
            <rect x="15" y="3" width="38" height="14" />
            <rect x="25" y="3" width="18" height="5" />
            <rect x="15" y="83" width="38" height="14" />
            <rect x="25" y="92" width="18" height="5" />
            <path d="M27 17a8 8 0 0 0 14 0M27 83a8 8 0 0 1 14 0" />
          </g>
          <circle cx="34" cy="50" r="0.6" fill="#fff" />
        </svg>
        {slots.map(({ slot, players }) => {
          const keeper = slot.positie === "GK";
          // The keeper's names go beside the shirt, so the defenders above have room.
          const beside = slot.y >= 85;
          return (
            <div
              key={slot.id}
              className={`absolute flex items-center gap-[0.6cqw] ${
                beside ? "w-[44cqw] -translate-x-[13cqw] -translate-y-1/2 flex-row" : "w-[27cqw] -translate-x-1/2 -translate-y-[30%] flex-col"
              }`}
              style={{ left: `${slot.x}%`, top: `${beside ? 91 : slot.y}%` }}
            >
              <Jersey
                color={keeper ? keeperColor : colors.primary}
                trim={keeper ? shade(keeperColor, 0.3) : colors.secondary}
                label={slot.positie}
                className="h-[10.5cqw] w-[11.5cqw] drop-shadow-md"
              />
              <div className={`flex min-w-0 flex-col gap-[0.6cqw] ${beside ? "items-start" : "w-full items-center"}`}>
                {players.length === 0 && <span className="rounded bg-black/25 px-1.5 text-[10px] text-white/70">{m.empty}</span>}
                {(players.length > MAX_ON_PITCH ? players.slice(0, MAX_ON_PITCH - 1) : players).map(chip)}
                {players.length > MAX_ON_PITCH && (
                  <button
                    type="button"
                    onClick={() => setOpenSlot(openSlot === slot.id ? null : slot.id)}
                    aria-expanded={openSlot === slot.id}
                    className="rounded-md bg-white/90 px-1.5 py-0.5 text-[clamp(9px,2.3cqw,12px)] leading-tight font-bold text-slate-900 shadow-sm hover:bg-white"
                  >
                    {m.more(players.length - MAX_ON_PITCH + 1)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openList && (
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-300">{m.allOnPost(openList.slot.positie)}</p>
            <button type="button" onClick={() => setOpenSlot(null)} className="text-[11px] font-semibold text-slate-400 hover:text-white">
              {messages.common.close}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">{openList.players.map(chip)}</div>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className="rounded-xl bg-white/5 px-3 py-2">
          <p className="mb-1.5 text-[11px] font-semibold text-slate-400">{m.unplaced}</p>
          <div className="flex flex-wrap gap-1">{unplaced.map(chip)}</div>
        </div>
      )}

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400">
        {PLAYER_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {pm.status[s]}
          </li>
        ))}
      </ul>

      {editing && <StatusDialog player={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function StatusDialog({
  player,
  onCancel,
  onSave,
}: {
  player: PitchPlayer;
  onCancel: () => void;
  onSave: (player: PitchPlayer, status: PlayerStatus, returnDate: string) => void;
}) {
  const [status, setStatus] = useState<PlayerStatus>(player.status);
  const [returnDate, setReturnDate] = useState(player.expectedReturnDate ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="status-title">
      <button type="button" aria-label={messages.common.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{m.statusTitle}</p>
          <h3 id="status-title" className="text-lg font-bold">
            {player.shirtNumber ? `${player.shirtNumber} · ` : ""}
            {player.firstName} {player.lastName}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PLAYER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${
                status === s ? "bg-slate-900 text-white ring-slate-900" : "text-slate-700 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              {pm.status[s]}
            </button>
          ))}
        </div>
        {status === "injured" && (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">{pm.form.expectedReturnDate}</span>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            />
            <span className="block text-xs text-slate-500">{pm.form.injuryPrivacy}</span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            {messages.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(player, status, returnDate)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {messages.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A shirt in the team colours with the position (or nothing) on it. */
function Jersey({ color, trim, label, className = "h-9 w-10 drop-shadow-md sm:h-11 sm:w-12" }: { color: string; trim: string; label?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden>
      <path d="M16 3l-12 6 4 11 5-2v23h22V18l5 2 4-11-12-6c-1.5 3.5-4.5 5.5-8 5.5S17.5 6.5 16 3z" fill={color} stroke={shade(color, 0.35)} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M16 3c1.5 3.5 4.5 5.5 8 5.5s6.5-2 8-5.5" fill="none" stroke={trim} strokeWidth="2.2" />
      <path d="M4.6 10.5l3.6 9.6M43.4 10.5l-3.6 9.6" stroke={trim} strokeWidth="2" />
      <text x="24" y="29" textAnchor="middle" fontSize="10" fontWeight="800" fill={readableOn(color)}>
        {label}
      </text>
    </svg>
  );
}
