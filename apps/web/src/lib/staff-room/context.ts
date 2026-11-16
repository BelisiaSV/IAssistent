import "server-only";

import type { Tables } from "@iassistent/db";
import type { VisionAnswers } from "@iassistent/staff-engine/content";

import { LIBRARY_COLUMNS, LIBRARY_LIMIT, libraryExercise } from "@/lib/exercises/library";
import { matchEvaluations } from "@/lib/opponents/context";
import { cardRules, suspensions, yellowCounts } from "@/lib/players/cards";
import { matchDayCatalog, periodizationCatalog, testCatalog, visionQuestionnaire } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { ageCategory } from "@/lib/teams/age-categories";
import { teamFormation } from "@/lib/teams/formation";
import { buildRoleContext } from "@/lib/weeks/context";
import { mondayOf, todayInBelgium } from "@/lib/weeks/dates";
import { contextForRole, loadWeek } from "@/lib/weeks/load";

import { turnOutput } from "./meetings";
import { stepOutput } from "./tasks";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Evaluations that go along (the most recent ones). */
const EVALUATIONS = 10;
/** Approved joint tasks that go along (the most recent ones). */
const APPROVED_TASKS = 5;
/** Approved staff meetings that go along (the most recent ones). */
const APPROVED_MEETINGS = 3;

/**
 * The approved context of a team that every role in the Staff Room may read:
 * the team, the vision of the head coach, the squad (shirt numbers, no names),
 * this week, the approved plans of this week, the approved joint tasks and
 * staff meetings, suspensions from cards and the exercise library. Built
 * with the same helpers as the week tasks, so the same privacy rules apply.
 */
export async function teamContextForChat(supabase: Supabase, team: Tables<"teams">, coachId: string) {
  const weekStart = mondayOf(todayInBelgium());
  const today = todayInBelgium();
  const [data, { data: profile }, { data: exercises }, { data: tasks }, { data: meetings }, { data: cards }, { data: reports }, { data: weeks }] = await Promise.all([
    loadWeek(supabase, team, weekStart),
    supabase.from("coach_profiles").select("vision_summary, vision").eq("coach_id", coachId).maybeSingle(),
    supabase
      .from("exercises")
      .select(LIBRARY_COLUMNS)
      .eq("use_in_planning", true)
      .order("updated_at", { ascending: false })
      .limit(LIBRARY_LIMIT),
    supabase
      .from("staff_tasks")
      .select("title, version, decided_at, staff_task_steps(version, phase, output)")
      .eq("team_id", team.id)
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(APPROVED_TASKS),
    supabase
      .from("staff_meetings")
      .select("assignment, version, decided_at, staff_meeting_turns(version, kind, output)")
      .eq("team_id", team.id)
      .eq("status", "approved")
      .order("decided_at", { ascending: false })
      .limit(APPROVED_MEETINGS),
    supabase.from("player_cards").select("player_id, match_date, card").eq("team_id", team.id),
    supabase.from("match_reports").select("match_date").eq("team_id", team.id).lte("match_date", today),
    supabase.from("week_plans").select("matches").eq("team_id", team.id).lte("week_start", today),
  ]);

  // Approved work of this week, per role (and task when it is not the default one).
  const approved = Object.fromEntries(
    data.proposals
      .filter((p) => p.status === "approved" && p.output)
      .map((p) => [p.task === "default" ? p.role : `${p.role}/${p.task}`, p.output]),
  );
  const vision = profile ? { summary: profile.vision_summary, vision: profile.vision } : null;
  const library = (exercises ?? []).map(libraryExercise);

  const context = data.week
    ? contextForRole(data, weekStart, { staff: approved, vision, feedback: null, library })
    : buildRoleContext({
        weekStart,
        trainings: [],
        matches: [],
        previousMatchDate: null,
        notes: null,
        players: data.players,
        visionSummary: vision?.summary ?? null,
        visionAnswers: ((vision?.vision ?? {}) as { antwoorden?: VisionAnswers }).antwoorden ?? {},
        questionnaire: visionQuestionnaire,
        matchDays: matchDayCatalog,
        periodization: periodizationCatalog,
        season: data.season,
        tests: testCatalog,
        testResults: data.testResults,
        history: data.history,
        opponent: null,
        evaluations: matchEvaluations(data.reports.filter((r) => r.match_date < weekStart).slice(0, EVALUATIONS), null),
        library,
        staff: approved,
        feedback: null,
      });

  // Cards: yellow cards this season and who is suspended for the next match.
  const played = [
    ...(reports ?? []).map((r) => r.match_date),
    ...(weeks ?? []).flatMap((w) => ((w.matches ?? []) as { date?: string }[]).flatMap((m) => (m.date && m.date <= today ? [m.date] : []))),
  ];
  const since = team.competition_start_date;
  const suspended = suspensions(cards ?? [], played, cardRules(team), since);
  const yellows = yellowCounts(cards ?? [], since);
  const byNumber = new Map(data.players.filter((p) => !p.archived_at && p.shirt_number !== null).map((p) => [p.shirt_number, p.id]));
  const kern = context.kern.map((k) => {
    const id = byNumber.get(k.rugnummer);
    const ban = id ? suspended.get(id) : undefined;
    return { ...k, gele_kaarten: (id && yellows.get(id)) || 0, geschorst_wedstrijden: ban?.matches ?? 0 };
  });

  return {
    team: { leeftijdscategorie: ageCategory(team.age_category), standaardformatie: teamFormation(team.default_formation).code },
    visie: context.visie,
    week: { ...context.weekinput, weekinput_ingevuld: !!data.week },
    kern,
    schorsingsregels: { gele_kaarten_per_schorsing: team.yellow_card_limit, wedstrijden_bij_gele_kaarten: team.yellow_card_ban, wedstrijden_bij_rode_kaart: team.red_card_ban },
    testen: context.testen,
    tegenstander: context.tegenstander,
    evaluaties: context.evaluaties,
    bibliotheek: context.bibliotheek,
    goedgekeurd: context.staf,
    goedgekeurde_taken: (tasks ?? []).flatMap((task) => {
      const final = stepOutput(task.staff_task_steps.find((s) => s.version === task.version && s.phase === "eindvoorstel")?.output);
      return final ? [{ titel: task.title, goedgekeurd_op: task.decided_at?.slice(0, 10) ?? null, voorstel: final }] : [];
    }),
    goedgekeurde_stafvergaderingen: (meetings ?? []).flatMap((meeting) => {
      const overview = turnOutput(meeting.staff_meeting_turns.find((t) => t.version === meeting.version && t.kind === "overzicht")?.output)?.overzicht;
      return overview ? [{ opdracht: meeting.assignment, goedgekeurd_op: meeting.decided_at?.slice(0, 10) ?? null, overzicht: overview }] : [];
    }),
  };
}
