import "server-only";

import type { Tables } from "@iassistent/db";
import { type VisionAnswers, weekPeriodization } from "@iassistent/staff-engine/content";

import { matchEvaluations, opponentContext, opponentKey } from "@/lib/opponents/context";
import { matchDayCatalog, periodizationCatalog, testCatalog, visionQuestionnaire } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";

import { buildRoleContext, loadHistory } from "./context";
import { addDays } from "./dates";
import { type WeekMatch, weekPlanSchema } from "./validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Team = Pick<Tables<"teams">, "id" | "competition_start_date" | "periodization_weeks">;

const HISTORY_WEEKS = 8;
const EVALUATIONS = 10;

/** Approved default-task proposal of a role (what other roles build on). */
export function approvedOutput(proposals: { role: string; task: string; status: string; output: unknown }[], roleId: string) {
  return proposals.find((p) => p.role === roleId && p.task === "default" && p.status === "approved")?.output ?? null;
}

/** Planned AU of a load plan (Physical Coach output), if present. */
export function plannedAu(output: unknown): number | null {
  const total = (output as { weektotaal?: { au_doel?: unknown } } | null)?.weektotaal?.au_doel;
  return typeof total === "number" ? total : null;
}

/** Everything about a week that the week page and the staff roles need. */
export async function loadWeek(supabase: Supabase, team: Team, weekStart: string) {
  const historyStart = addDays(weekStart, -7 * HISTORY_WEEKS);
  const [{ data: week }, { data: players }, { data: sessions }, { data: tests }, { data: pastWeeks }] =
    await Promise.all([
      supabase.from("week_plans").select("*").eq("team_id", team.id).eq("week_start", weekStart).maybeSingle(),
      supabase.from("players").select("*").eq("team_id", team.id),
      supabase
        .from("session_loads")
        .select("*")
        .eq("team_id", team.id)
        .gte("session_date", historyStart)
        .lt("session_date", addDays(weekStart, 7)),
      supabase.from("fitness_tests").select("player_id, test_code, test_date, result").eq("team_id", team.id),
      supabase
        .from("week_plans")
        .select("week_start, staff_proposals(role, task, status, version, output)")
        .eq("team_id", team.id)
        .gte("week_start", historyStart)
        .lt("week_start", weekStart)
        .order("week_start", { ascending: true }),
    ]);

  const proposals = week
    ? ((
        await supabase
          .from("staff_proposals")
          .select("*")
          .eq("week_plan_id", week.id)
          .order("version", { ascending: false })
      ).data ?? [])
    : [];

  const season = {
    competitionStartDate: team.competition_start_date,
    periodizationWeeks: team.periodization_weeks,
  };
  const periodization = weekPeriodization(weekStart, season.competitionStartDate, season.periodizationWeeks, periodizationCatalog);

  const history = loadHistory(
    Array.from({ length: HISTORY_WEEKS }, (_, i) => {
      const start = addDays(historyStart, i * 7);
      const plan = (pastWeeks ?? []).find((w) => w.week_start === start);
      const loadPlan = (plan?.staff_proposals ?? [])
        .filter((p) => p.role === "physical-coach" && p.task === "default" && p.output)
        .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved") || b.version - a.version)[0];
      return {
        week_start: start,
        weektype: weekPeriodization(start, season.competitionStartDate, season.periodizationWeeks, periodizationCatalog).weektype?.code ?? null,
        planned_au: plannedAu(loadPlan?.output),
      };
    }),
    (sessions ?? []).filter((s) => s.session_date < weekStart),
  ).filter((w) => w.gepland_au !== null || w.werkelijk_au !== null);

  // Next opponent: the first match of the week, linked to the fiche by name.
  const nextMatch = ((week?.matches ?? []) as WeekMatch[]).toSorted((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const [{ data: opponents }, { data: reports }] = await Promise.all([
    supabase.from("opponents").select("*").eq("team_id", team.id),
    supabase
      .from("match_reports")
      .select("*")
      .eq("team_id", team.id)
      .lt("match_date", addDays(weekStart, 7))
      .order("match_date", { ascending: false })
      .limit(EVALUATIONS + 3),
  ]);
  const opponent = nextMatch
    ? ((opponents ?? []).find((o) => opponentKey(o.name) === opponentKey(nextMatch.opponent)) ?? null)
    : null;
  const opponentLineup = opponent
    ? ((
        await supabase
          .from("opponent_lineups")
          .select("*")
          .eq("opponent_id", opponent.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data ?? null)
    : null;

  return {
    week,
    nextMatch,
    opponent,
    opponentLineup,
    opponents: opponents ?? [],
    reports: reports ?? [],
    players: players ?? [],
    proposals,
    sessionsThisWeek: (sessions ?? []).filter((s) => s.session_date >= weekStart),
    testResults: (tests ?? []).map((t) => ({ ...t, result: Number(t.result) })),
    history,
    periodization,
    season,
  };
}

export type WeekData = Awaited<ReturnType<typeof loadWeek>>;

/** The context a staff role gets for this week (no player names). */
export function contextForRole(
  data: WeekData,
  weekStart: string,
  options: {
    uses: readonly string[];
    vision: { summary: string | null; vision: unknown } | null;
    feedback: { previousOutput: unknown; comment: string } | null;
  },
) {
  if (!data.week) throw new Error("week plan missing");
  const parsed = weekPlanSchema(weekStart).parse({
    trainings: data.week.trainings,
    matches: data.week.matches,
    previousMatchDate: data.week.previous_match_date,
    notes: data.week.notes ?? "",
  });
  const staff = Object.fromEntries(
    options.uses.flatMap((roleId) => {
      const output = approvedOutput(data.proposals, roleId);
      return output ? [[roleId, output]] : [];
    }),
  );
  const opponent = data.nextMatch
    ? opponentContext({
        name: data.nextMatch.opponent,
        home: data.nextMatch.home,
        opponent: data.opponent,
        lineup: data.opponentLineup,
      })
    : null;
  const evaluations = matchEvaluations(
    data.reports.filter((r) => r.match_date < weekStart).slice(0, EVALUATIONS),
    opponent?.formatie ?? null,
  );

  return buildRoleContext({
    weekStart,
    trainings: parsed.trainings,
    matches: parsed.matches,
    previousMatchDate: parsed.previousMatchDate,
    notes: parsed.notes,
    players: data.players,
    visionSummary: options.vision?.summary ?? null,
    visionAnswers: ((options.vision?.vision ?? {}) as { antwoorden?: VisionAnswers }).antwoorden ?? {},
    questionnaire: visionQuestionnaire,
    matchDays: matchDayCatalog,
    periodization: periodizationCatalog,
    season: data.season,
    tests: testCatalog,
    testResults: data.testResults,
    history: data.history,
    opponent,
    evaluations,
    staff,
    feedback: options.feedback,
  });
}
