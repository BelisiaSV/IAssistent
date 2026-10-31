import { weekPeriodization } from "@iassistent/staff-engine/content";

import { TeamDashboard } from "@/components/dashboard/team-dashboard";
import { themeForTeam } from "@/lib/animation/team-theme";
import { opponentKey } from "@/lib/opponents/context";
import { PLAYER_STATUSES, type PlayerStatus } from "@/lib/players/validation";
import { formationCatalog, matchDayCatalog, periodizationCatalog, positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { nextMatch, seasonResults } from "@/lib/teams/dashboard";
import { depthChart } from "@/lib/teams/depth-chart";
import { teamFormation } from "@/lib/teams/formation";
import { dayPlans } from "@/lib/teams/microcycle";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, mondayOf, todayInBelgium, weekDates } from "@/lib/weeks/dates";
import { seasonPlan } from "@/lib/weeks/season";

/** Days shown under "today" in the microcycle (today included). */
const UPCOMING_DAYS = 5;

export default async function TeamDashboardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, logoUrl, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const today = todayInBelgium();
  const weekStart = mondayOf(today);

  const [{ data: weeks }, { data: reports }, { data: players }, { data: lineups }, { data: opponents }] = await Promise.all([
    supabase
      .from("week_plans")
      .select("week_start, trainings, matches, previous_match_date")
      .eq("team_id", team.id)
      .gte("week_start", addDays(weekStart, -7))
      .order("week_start")
      .limit(8),
    supabase.from("match_reports").select("match_date, opponent_name, home, goals_for, goals_against").eq("team_id", team.id),
    supabase
      .from("players")
      .select("id, first_name, last_name, shirt_number, primary_position, secondary_positions, status, expected_return_date")
      .eq("team_id", team.id)
      .is("archived_at", null)
      .order("shirt_number", { nullsFirst: false }),
    supabase
      .from("lineups")
      .select("id, title, formation, starters, bench")
      .eq("team_id", team.id)
      .order("match_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("opponents").select("id, name, address, coach_name").eq("team_id", team.id),
  ]);

  const squad = (players ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    shirtNumber: p.shirt_number,
    primaryPosition: p.primary_position,
    secondaryPositions: p.secondary_positions,
    status: p.status,
    expectedReturnDate: p.expected_return_date,
  }));
  const byId = new Map(squad.map((p) => [p.id, p]));
  const shortName = (p: (typeof squad)[number]) => `${p.firstName} ${p.lastName.slice(0, 1)}.`;
  const formation = teamFormation(team.default_formation);
  const chart = depthChart(squad, formation.posten, positionCatalog);
  const counts = Object.fromEntries(PLAYER_STATUSES.map((st) => [st, squad.filter((p) => p.status === st).length])) as Record<PlayerStatus, number>;

  const allResults = seasonResults(reports ?? [], null);
  const seasonSoFar = seasonResults(reports ?? [], team.competition_start_date);
  const upcomingDates = Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i));

  const next = nextMatch(weeks ?? [], today);
  const opponent = next ? (opponents ?? []).find((o) => opponentKey(o.name) === opponentKey(next.opponent)) : undefined;

  const last = lineups?.[0];
  const lineupFormation = last ? formationCatalog.formaties.find((f) => f.code === last.formation) : undefined;
  const starters = (last?.starters ?? {}) as Record<string, string>;

  return (
    <TeamDashboard
      team={{
        id: team.id,
        name: team.name,
        clubName: team.club_name,
        season: team.season,
        primaryColor: team.primary_color,
        secondaryColor: team.secondary_color,
      }}
      logoUrl={logoUrl}
      today={today}
      next={next}
      venue={next ? { address: next.home ? team.home_address : (opponent?.address ?? null), coach: opponent?.coach_name ?? null } : null}
      form={{ matches: allResults.matches.slice(-5).reverse(), points: seasonSoFar.points, played: seasonSoFar.matches.length }}
      microcycle={{
        weekStart,
        weekType: weekPeriodization(weekStart, seasonPlan(team), periodizationCatalog).weektype?.naam ?? null,
        week: dayPlans(weekDates(weekStart), weeks ?? [], matchDayCatalog),
        upcoming: dayPlans(upcomingDates, weeks ?? [], matchDayCatalog),
      }}
      squad={{
        canEdit,
        formation: formation.naam,
        slots: formation.posten.map((slot) => ({ slot, players: chart.slots.get(slot.id) ?? [] })),
        unplaced: chart.unplaced,
        counts,
        total: squad.length,
        keeperColor: themeForTeam(team.animation_settings).theme.doelman.eigen ?? team.secondary_color,
      }}
      lineup={
        last && lineupFormation
          ? {
              id: last.id,
              title: last.title,
              formation: lineupFormation.naam,
              spots: lineupFormation.posten.map((slot) => {
                const p = starters[slot.id] ? byId.get(starters[slot.id]!) : undefined;
                return { slot, player: p ? { number: p.shirtNumber, name: shortName(p) } : null };
              }),
              bench: last.bench.flatMap((id) => {
                const p = byId.get(id);
                return p ? [{ id: p.id, number: p.shirtNumber, name: shortName(p), position: p.primaryPosition, status: p.status }] : [];
              }),
            }
          : null
      }
    />
  );
}
