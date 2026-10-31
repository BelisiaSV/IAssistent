import { FEATURE_FLAGS, type FeatureFlagKey } from "@iassistent/db";

import { type DashboardRole, TeamDashboard } from "@/components/dashboard/team-dashboard";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { opponentKey } from "@/lib/opponents/context";
import { PLAYER_STATUSES, type PlayerStatus } from "@/lib/players/validation";
import { positionCatalog, roleSummaries } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { nextMatch, seasonResults } from "@/lib/teams/dashboard";
import { depthChart } from "@/lib/teams/depth-chart";
import { teamFormation } from "@/lib/teams/formation";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, mondayOf, todayInBelgium } from "@/lib/weeks/dates";

/** Flag that switches a role on; roles without one (not built yet) show as "soon". */
const ROLE_FLAGS: Record<string, FeatureFlagKey> = {
  "assistant-coach": FEATURE_FLAGS.assistantCoach,
  "physical-coach": FEATURE_FLAGS.physicalCoach,
  "tactical-coach": FEATURE_FLAGS.tacticalCoach,
};
/** Order of the staff on the dashboard. */
const ROLE_ORDER = ["assistant-coach", "tactical-coach", "physical-coach", "video-analyst"];

export default async function TeamDashboardPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, logoUrl, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const today = todayInBelgium();

  const [{ data: weeks }, { data: reports }, { data: opponents }, { data: players }] = await Promise.all([
    supabase
      .from("week_plans")
      .select("week_start, matches")
      .eq("team_id", team.id)
      .gte("week_start", addDays(mondayOf(today), -7))
      .order("week_start")
      .limit(8),
    supabase.from("match_reports").select("match_date, opponent_name, home, goals_for, goals_against").eq("team_id", team.id),
    supabase.from("opponents").select("id, name, address, coach_name").eq("team_id", team.id),
    supabase
      .from("players")
      .select("id, first_name, last_name, shirt_number, primary_position, secondary_positions, status, expected_return_date")
      .eq("team_id", team.id)
      .is("archived_at", null)
      .order("shirt_number", { nullsFirst: false }),
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
  const formation = teamFormation(team.default_formation);
  const chart = depthChart(squad, formation.posten, positionCatalog);
  const counts = Object.fromEntries(PLAYER_STATUSES.map((st) => [st, squad.filter((p) => p.status === st).length])) as Record<PlayerStatus, number>;

  const next = nextMatch(weeks ?? [], today);
  const opponent = next ? (opponents ?? []).find((o) => opponentKey(o.name) === opponentKey(next.opponent)) : undefined;

  const summaries = roleSummaries().sort((a, b) => ROLE_ORDER.indexOf(a.id) - ROLE_ORDER.indexOf(b.id));
  const roles: DashboardRole[] = await Promise.all(
    summaries.map(async (r) => {
      const flag = ROLE_FLAGS[r.id];
      const status = r.status === "placeholder" || !flag ? "soon" : (await isFeatureEnabled(flag)) ? "active" : "off";
      return { id: r.id, name: r.name, goal: r.goal, status };
    }),
  );

  return (
    <TeamDashboard
      team={{
        id: team.id,
        clubName: team.club_name,
        primaryColor: team.primary_color,
        secondaryColor: team.secondary_color,
        homeAddress: team.home_address,
        competitionStart: team.competition_start_date,
        animationSettings: team.animation_settings,
      }}
      logoUrl={logoUrl}
      today={today}
      next={next}
      opponent={opponent ? { id: opponent.id, address: opponent.address, coachName: opponent.coach_name } : null}
      season={seasonResults(reports ?? [], team.competition_start_date)}
      form={seasonResults(reports ?? [], null).matches.slice(-5).reverse()}
      roles={roles}
      squad={{
        canEdit,
        formation: formation.naam,
        slots: formation.posten.map((slot) => ({ slot, players: chart.slots.get(slot.id) ?? [] })),
        unplaced: chart.unplaced,
        counts,
        total: squad.length,
      }}
    />
  );
}
