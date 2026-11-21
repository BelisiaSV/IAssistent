import "server-only";

import type { QualityReviewRow } from "@/components/quality/quality-review";
import { matchDayCatalog } from "@/lib/staff";
import { type DayPlan, dayPlans } from "@/lib/teams/microcycle";
import { addDays, mondayOf, weekDates } from "@/lib/weeks/dates";

import type { getClubContext } from "./load";
import type { PeriodRow } from "./periods";

type Ctx = Awaited<ReturnType<typeof getClubContext>>;

/** One week of one team: planned and done trainings, matches, approved week document. */
export interface PlanningWeek {
  weekStart: string;
  /** The team has a week input for this week. */
  hasInput: boolean;
  trainings: number;
  minutes: number;
  matches: number;
  /** Trainings with a logged session load (RPE). */
  done: number;
  approved: boolean;
  quality: QualityReviewRow | null;
}

export interface PlanningTeam {
  id: string;
  name: string;
  ageCategory: string;
  headCoach: string | null;
  /** Days of the first week (week view), with MD labels; `done` = a logged session. */
  days: (DayPlan & { done: boolean })[];
  weeks: PlanningWeek[];
}

export interface ClubPlanning {
  teams: PlanningTeam[];
  periods: (PeriodRow & { id: string })[];
  weekStarts: string[];
}

/**
 * The planning of the club's teams between two Mondays (inclusive), built on
 * the week inputs, approved week documents, session loads and quality checks.
 * RLS limits it to the teams the user may read.
 */
export async function loadClubPlanning(ctx: Ctx, firstMonday: string, lastMonday: string): Promise<ClubPlanning> {
  const { supabase, club } = ctx;
  const weekStarts: string[] = [];
  for (let w = mondayOf(firstMonday); w <= lastMonday; w = addDays(w, 7)) weekStarts.push(w);
  const end = addDays(lastMonday, 6);

  const [{ data: teams }, { data: periods }, { data: staff }] = await Promise.all([
    supabase.from("teams").select("id, name, age_category").eq("club_id", club.id).is("archived_at", null).order("name"),
    supabase
      .from("club_periods")
      .select("id, title, starts_on, ends_on, age_categories, goals, focus")
      .eq("club_id", club.id)
      .order("starts_on"),
    supabase.from("team_staff").select("team_id, coach_id, role").eq("club_id", club.id).is("ended_at", null),
  ]);
  const teamIds = (teams ?? []).map((t) => t.id);
  const empty = { data: [] as never[] };
  // A week before the range for the MD labels after the previous match.
  const [{ data: weeks }, { data: loads }, { data: coaches }] = await Promise.all([
    teamIds.length
      ? supabase
          .from("week_plans")
          .select("id, team_id, week_start, trainings, matches, previous_match_date")
          .in("team_id", teamIds)
          .gte("week_start", addDays(weekStarts[0]!, -7))
          .lte("week_start", lastMonday)
      : empty,
    teamIds.length
      ? supabase
          .from("session_loads")
          .select("team_id, session_date, kind")
          .in("team_id", teamIds)
          .eq("kind", "training")
          .gte("session_date", weekStarts[0]!)
          .lte("session_date", end)
      : empty,
    (staff ?? []).length
      ? supabase.from("coaches").select("id, full_name, email").in("id", [...new Set((staff ?? []).map((s) => s.coach_id))])
      : empty,
  ]);
  const weekIds = (weeks ?? []).map((w) => w.id);
  const { data: runs } = weekIds.length
    ? await supabase
        .from("staff_runs")
        .select("id, week_plan_id")
        .in("week_plan_id", weekIds)
        .eq("kind", "week")
        .eq("status", "approved")
        .is("deleted_at", null)
    : empty;
  const runIds = (runs ?? []).map((r) => r.id);
  const { data: reviews } = runIds.length
    ? await supabase
        .from("training_quality_reviews")
        .select("run_id, status, output, average, verdict, created_at")
        .in("run_id", runIds)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
    : empty;

  const coachName = new Map((coaches ?? []).map((c) => [c.id, c.full_name ?? c.email]));
  const doneDates = new Set((loads ?? []).map((l) => `${l.team_id}:${l.session_date}`));

  const result: PlanningTeam[] = (teams ?? []).map((t) => {
    const teamWeeks = (weeks ?? []).filter((w) => w.team_id === t.id);
    const head = (staff ?? []).find((s) => s.team_id === t.id && s.role === "head_coach");
    const plans = dayPlans(
      weekStarts.flatMap((w) => weekDates(w)),
      teamWeeks,
      matchDayCatalog,
    ).map((d) => ({ ...d, done: !!d.training && doneDates.has(`${t.id}:${d.date}`) }));
    return {
      id: t.id,
      name: t.name,
      ageCategory: t.age_category,
      headCoach: head ? (coachName.get(head.coach_id) ?? null) : null,
      days: plans.slice(0, 7),
      weeks: weekStarts.map((weekStart) => {
        const days = plans.filter((d) => d.date >= weekStart && d.date <= addDays(weekStart, 6));
        const week = teamWeeks.find((w) => w.week_start === weekStart);
        const run = week ? (runs ?? []).find((r) => r.week_plan_id === week.id) : undefined;
        return {
          weekStart,
          hasInput: !!week,
          trainings: days.filter((d) => d.training).length,
          minutes: days.reduce((sum, d) => sum + (d.training?.minutes ?? 0), 0),
          matches: days.filter((d) => d.match).length,
          done: days.filter((d) => d.done).length,
          approved: !!run,
          quality: run ? ((reviews ?? []).find((r) => r.run_id === run.id) ?? null) : null,
        };
      }),
    };
  });
  return { teams: result, periods: periods ?? [], weekStarts };
}
