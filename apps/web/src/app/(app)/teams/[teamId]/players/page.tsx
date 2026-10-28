import type { Tables } from "@iassistent/db";

import { ButtonLink, Card, CardHeader, EmptyState, StatTile } from "@/components/card";
import { messages } from "@/lib/messages";
import { PLAYER_STATUSES } from "@/lib/players/validation";
import { readableOn, shade } from "@/lib/proposals/overview";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { restorePlayer } from "./actions";
import { PlayerCard, ShirtNumber } from "./player-card";

const m = messages.players;

type Player = Tables<"players">;

/** Dot colour per status (counts on the players page). */
const STATUS_COLORS: Record<Player["status"], string> = {
  available: "#16a34a",
  injured: "#dc2626",
  suspended: "#d97706",
  unavailable: "#94a3b8",
};

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

  const ink = readableOn(team.primary_color) === "#ffffff" ? team.primary_color : shade(team.primary_color, 0.5);
  const counts = Object.fromEntries(PLAYER_STATUSES.map((st) => [st, active.filter((p) => p.status === st).length])) as Record<
    (typeof PLAYER_STATUSES)[number],
    number
  >;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title={m.squad}
          hint={m.count(active.length)}
          action={
            canEdit && (
              <ButtonLink href={`/teams/${team.id}/players/new`} color={team.primary_color}>
                + {m.add}
              </ButtonLink>
            )
          }
        />
        <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-5">
          <StatTile label={m.squad} value={active.length} ink={ink} />
          {PLAYER_STATUSES.map((st) => (
            <StatTile key={st} label={m.status[st]} value={counts[st]} dot={STATUS_COLORS[st]} />
          ))}
        </div>
      </Card>

      {active.length === 0 && <EmptyState text={m.empty} href={canEdit ? `/teams/${team.id}/players/new` : undefined} link={m.add} />}

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">
            <span className="h-3 w-1 rounded-full" style={{ backgroundColor: team.primary_color }} />
            {group.name}
            <span className="font-medium text-slate-400">{group.players.length}</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.players.map((player) => (
              <PlayerCard key={player.id} player={player} teamId={team.id} canEdit={canEdit} color={team.primary_color} />
            ))}
          </ul>
        </section>
      ))}

      {archived.length > 0 && (
        <details className="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <summary className="cursor-pointer list-none px-5 py-4 text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">
            {m.archived} <span className="font-medium text-slate-400">{archived.length}</span>
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {archived.map((player) => (
              <li key={player.id} className="flex items-center gap-3 px-5 py-3">
                <ShirtNumber value={player.shirt_number} color="#94a3b8" />
                <span className="flex-1 text-sm text-slate-600">
                  {player.first_name} {player.last_name}
                </span>
                {canEdit && (
                  <form action={restorePlayer}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="playerId" value={player.id} />
                    <button type="submit" className="text-sm font-medium text-slate-600 hover:text-brand">
                      {m.restore}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
