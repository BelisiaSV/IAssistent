import "server-only";

import { opponentKey } from "@/lib/opponents/context";
import { loadPresentation } from "@/lib/presentation/load";
import { sameTeam, teamSeason } from "@/lib/presentation/stats";
import { createClient } from "@/lib/supabase/server";
import type { PlayedMatch } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";

export interface OpponentStanding {
  position: number;
  teams: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Wedstrijdanalyse → Volgende wedstrijd: the next match (or the one on
 * `date`) and its opponent: logo, standing, form, season and lineup. Built on
 * the data of the match presentation; names are only shown, nothing goes to the AI.
 */
export async function loadNextMatch(teamId: string, date: string | undefined) {
  const presentation = await loadPresentation(teamId, date);
  const { team } = await getTeamContext(teamId);
  const supabase = await createClient();
  const match = presentation.match;
  if (!match) return { presentation, standing: null, season: [] as PlayedMatch[], fiche: null };

  const { data: opponents } = await supabase.from("opponents").select("id, name, address, coach_name").eq("team_id", team.id);
  const fiche = (opponents ?? []).find((o) => opponentKey(o.name) === opponentKey(match.opponent)) ?? null;

  let standing: OpponentStanding | null = null;
  let season: PlayedMatch[] = [];
  if (team.federation_team && team.federation_divisions.length) {
    const [{ data: all }, { data: standings }] = await Promise.all([
      supabase.from("competition_matches").select("*").in("division", team.federation_divisions),
      supabase.from("competition_standings").select("*").in("division", team.federation_divisions).eq("period", 0),
    ]);
    const name = (all ?? []).flatMap((m) => [m.home, m.away]).find((n) => sameTeam(n, match.opponent));
    if (name) {
      season = teamSeason(all ?? [], name, match.date);
      const row = (standings ?? []).find((s) => sameTeam(s.team, name));
      if (row) {
        standing = {
          position: row.position,
          teams: (standings ?? []).filter((s) => s.division === row.division).length,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goals_for,
          goalsAgainst: row.goals_against,
          points: row.points,
        };
      }
    }
  }
  return { presentation, standing, season, fiche };
}
