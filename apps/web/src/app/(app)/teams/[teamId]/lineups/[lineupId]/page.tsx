import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { messages } from "@/lib/messages";
import { formationCatalog, positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { deleteLineup } from "../actions";
import { DeleteLineupButton } from "./delete-button";
import { LineupEditor, type LineupPlayer } from "./lineup-editor";

export default async function LineupPage({
  params,
}: {
  params: Promise<{ teamId: string; lineupId: string }>;
}) {
  const { teamId, lineupId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  if (!z.uuid().safeParse(lineupId).success) notFound();

  const supabase = await createClient();
  const [{ data: lineup }, { data: players }] = await Promise.all([
    supabase.from("lineups").select("*").eq("id", lineupId).eq("team_id", team.id).maybeSingle(),
    supabase.from("players").select("*").eq("team_id", team.id),
  ]);
  if (!lineup) notFound();

  const squad: LineupPlayer[] = (players ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    shirtNumber: p.shirt_number,
    primaryPosition: p.primary_position,
    secondaryPositions: p.secondary_positions,
    preferredFoot: p.preferred_foot,
    status: p.status,
    archived: !!p.archived_at,
  }));
  const squadIds = new Set(squad.map((p) => p.id));

  // Drop references to players that no longer exist.
  const starters = Object.fromEntries(
    Object.entries((lineup.starters ?? {}) as Record<string, string>).filter(([, id]) => squadIds.has(id)),
  );
  const bench = lineup.bench.filter((id) => squadIds.has(id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={`/teams/${team.id}/lineups`} className="text-sm text-slate-600 hover:text-brand">
          ← {messages.lineups.title}
        </Link>
        {canEdit && (
          <DeleteLineupButton action={deleteLineup} teamId={team.id} lineupId={lineup.id} />
        )}
      </div>
      <LineupEditor
        teamId={team.id}
        lineupId={lineup.id}
        details={{
          title: lineup.title,
          matchDate: lineup.match_date ?? "",
          opponent: lineup.opponent ?? "",
        }}
        initial={{ formation: lineup.formation, starters, bench }}
        players={squad}
        formations={formationCatalog}
        positions={positionCatalog}
        colors={{ primary: team.primary_color, secondary: team.secondary_color }}
        canEdit={canEdit}
      />
    </div>
  );
}
