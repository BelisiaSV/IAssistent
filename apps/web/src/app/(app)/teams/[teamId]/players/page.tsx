import type { Tables } from "@iassistent/db";
import Link from "next/link";

import { messages } from "@/lib/messages";
import { seasonsAtClub } from "@/lib/season";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { restorePlayer } from "./actions";
import { StatusBadge, StatusSelect } from "./status-select";

const m = messages.players;

type Player = Tables<"players">;

const dateFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short" });

function byShirtNumber(a: Player, b: Player) {
  return (a.shirt_number ?? 999) - (b.shirt_number ?? 999) || a.last_name.localeCompare(b.last_name);
}

export default async function PlayersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("team_id", team.id);
  const players = data ?? [];

  const active = players.filter((p) => !p.archived_at).sort(byShirtNumber);
  const archived = players.filter((p) => p.archived_at).sort(byShirtNumber);

  const positionByCode = new Map(positionCatalog.posities.map((p) => [p.code, p]));
  const groups = [
    ...positionCatalog.linies.map((line) => ({
      id: line.id,
      name: line.naam,
      players: active.filter(
        (p) => p.primary_position && positionByCode.get(p.primary_position)?.linie === line.id,
      ),
    })),
    {
      id: "none",
      name: m.noPosition,
      players: active.filter((p) => !p.primary_position || !positionByCode.has(p.primary_position)),
    },
  ].filter((g) => g.players.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{m.count(active.length)}</p>
        {canEdit && (
          <Link
            href={`/teams/${team.id}/players/new`}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {m.add}
          </Link>
        )}
      </div>

      {active.length === 0 && <p className="text-slate-600">{m.empty}</p>}

      {groups.map((group) => (
        <section key={group.id} className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{group.name}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            {group.players.map((player) => (
              <PlayerRow key={player.id} player={player} teamId={team.id} canEdit={canEdit} />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{m.archived}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl bg-white opacity-75 shadow-sm ring-1 ring-slate-200">
            {archived.map((player) => (
              <li key={player.id} className="flex items-center gap-3 px-4 py-3">
                <ShirtNumber value={player.shirt_number} color={team.primary_color} />
                <span className="flex-1 text-sm">
                  {player.first_name} {player.last_name}
                </span>
                {canEdit && (
                  <form action={restorePlayer}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="playerId" value={player.id} />
                    <button type="submit" className="text-sm text-slate-600 hover:text-brand">
                      {m.restore}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShirtNumber({ value, color }: { value: number | null; color: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {value ?? "–"}
    </span>
  );
}

function PlayerRow({ player, teamId, canEdit }: { player: Player; teamId: string; canEdit: boolean }) {
  const positions = [player.primary_position, ...player.secondary_positions].filter(Boolean).join(" · ");
  const details = [
    positions,
    player.preferred_foot ? m.foot[player.preferred_foot] : null,
    player.joined_club_year ? m.seasonsAtClub(seasonsAtClub(player.joined_club_year)) : null,
  ].filter(Boolean);

  const name = (
    <>
      <span className="block truncate font-medium">
        {player.first_name} {player.last_name}
      </span>
      <span className="block truncate text-xs text-slate-500">{details.join(" · ")}</span>
    </>
  );

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
        {player.shirt_number ?? "–"}
      </span>
      {canEdit ? (
        <Link href={`/teams/${teamId}/players/${player.id}`} className="min-w-0 flex-1 hover:text-brand">
          {name}
        </Link>
      ) : (
        <div className="min-w-0 flex-1">{name}</div>
      )}
      <div className="flex flex-col items-end gap-1">
        {canEdit ? (
          <StatusSelect key={player.status} teamId={teamId} playerId={player.id} status={player.status} />
        ) : (
          <StatusBadge status={player.status} />
        )}
        {player.status === "injured" && player.expected_return_date && (
          <span className="text-xs text-slate-500">
            {m.returnExpected(dateFormat.format(new Date(player.expected_return_date)))}
          </span>
        )}
      </div>
    </li>
  );
}
