import type { Tables } from "@iassistent/db";
import Link from "next/link";

import { messages } from "@/lib/messages";
import { readableOn, shade, withAlpha } from "@/lib/proposals/overview";
import { seasonsAtClub } from "@/lib/season";

import { StatusBadge, StatusSelect } from "./status-select";

const m = messages.players;
const dateFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

type Player = Tables<"players">;

export function ShirtNumber({ value, color, large = false }: { value: number | null; color: string; large?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-black tabular-nums ${large ? "h-14 w-14 rounded-xl text-2xl" : "h-9 w-9 rounded-lg text-sm"}`}
      style={{ backgroundColor: color, color: readableOn(color) }}
    >
      {value ?? "–"}
    </span>
  );
}

/** A player of the squad: shirt number in the team colour, name, positions and status. */
export function PlayerCard({ player, teamId, canEdit, color }: { player: Player; teamId: string; canEdit: boolean; color: string }) {
  const positions = [player.primary_position, ...player.secondary_positions].filter((p): p is string => !!p);
  const details = [
    player.preferred_foot ? m.footLabel(m.foot[player.preferred_foot]) : null,
    player.joined_club_year ? m.seasonsAtClub(seasonsAtClub(player.joined_club_year)) : null,
  ].filter(Boolean);
  const unavailable = player.status !== "available";

  const body = (
    <div className="flex items-start gap-3">
      <ShirtNumber value={player.shirt_number} color={unavailable ? "#94a3b8" : color} large />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-500">{player.first_name}</p>
        <p className="truncate text-base leading-tight font-bold text-slate-900">{player.last_name}</p>
        {positions.length > 0 && (
          <p className="mt-1.5 flex flex-wrap gap-1">
            {positions.map((code, i) => (
              <span
                key={code + i}
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${i === 0 ? "" : "bg-slate-100 text-slate-600"}`}
                style={i === 0 ? { backgroundColor: withAlpha(color, 0.12), color: shade(color, 0.2) } : undefined}
              >
                {code}
              </span>
            ))}
          </p>
        )}
        {details.length > 0 && <p className="mt-1.5 text-xs text-slate-500">{details.join(" · ")}</p>}
      </div>
    </div>
  );

  const returnDate =
    player.status === "injured" && player.expected_return_date ? m.returnExpected(dateFormat.format(new Date(player.expected_return_date))) : null;

  return (
    <li className="relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md">
      {canEdit ? (
        <Link href={`/teams/${teamId}/players/${player.id}`} className="block pr-28">
          {body}
        </Link>
      ) : (
        <div className="pr-28">{body}</div>
      )}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
        {canEdit ? (
          <StatusSelect key={player.status} teamId={teamId} playerId={player.id} status={player.status} />
        ) : (
          <StatusBadge status={player.status} />
        )}
        {returnDate && <span className="text-right text-[11px] font-medium text-red-700">{returnDate}</span>}
      </div>
    </li>
  );
}
