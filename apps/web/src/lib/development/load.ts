import "server-only";

import { recurringPoints } from "@iassistent/staff-engine/content";

import { staff } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/weeks/dates";
import { weekTrainingSchema } from "@/lib/weeks/validation";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const trainingList = weekTrainingSchema.array();

/** Recurring improvement points of the quality checks: criterion code → how many approved weeks named it. */
export function qualityPoints(outputs: readonly unknown[]): { code: string; naam: string; aantal: number }[] {
  const counts = new Map<string, number>();
  for (const output of outputs) {
    const points = (output as { verbeterpunten?: { criterium: string }[] } | null)?.verbeterpunten ?? [];
    for (const code of new Set(points.map((p) => p.criterium))) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return staff.quality.criteria
    .map((c) => ({ code: c.code, naam: c.naam, aantal: counts.get(c.code) ?? 0 }))
    .filter((c) => c.aantal >= 2)
    .sort((a, b) => b.aantal - a.aantal);
}

/**
 * Evaluations and development of teams between two dates: the trainings of
 * the week inputs, their evaluations and session loads, team and player goals,
 * and the quality checks of the approved week documents. RLS limits it to the
 * teams the user may read.
 */
export async function loadDevelopment(supabase: Supabase, teamIds: string[], from: string, to: string) {
  const empty = { data: [] as never[] };
  if (!teamIds.length) return null;
  const [{ data: weeks }, { data: evaluations }, { data: loads }, { data: goals }, { data: playerGoals }, { data: runs }] = await Promise.all([
    supabase
      .from("week_plans")
      .select("team_id, week_start, trainings")
      .in("team_id", teamIds)
      .gte("week_start", addDays(from, -6))
      .lte("week_start", to),
    supabase
      .from("training_evaluations")
      .select("id, team_id, session_date, rating, went_well, to_improve, attention_points")
      .in("team_id", teamIds)
      .gte("session_date", from)
      .lte("session_date", to)
      .order("session_date", { ascending: false }),
    supabase
      .from("session_loads")
      .select("team_id, session_date")
      .in("team_id", teamIds)
      .eq("kind", "training")
      .gte("session_date", from)
      .lte("session_date", to),
    supabase.from("team_goals").select("*").in("team_id", teamIds).order("created_at"),
    supabase.from("player_goals").select("*").in("team_id", teamIds).order("created_at"),
    supabase
      .from("staff_runs")
      .select("id, team_id, week_plan_id, week_plans!inner(week_start)")
      .in("team_id", teamIds)
      .eq("kind", "week")
      .eq("status", "approved")
      .is("deleted_at", null)
      .gte("week_plans.week_start", addDays(from, -6))
      .lte("week_plans.week_start", to),
  ]);
  const runIds = (runs ?? []).map((r) => r.id);
  const { data: reviews } = runIds.length
    ? await supabase
        .from("training_quality_reviews")
        .select("run_id, team_id, status, output, average, verdict, created_at")
        .in("run_id", runIds)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
    : empty;
  // The latest check per approved run.
  const latest = new Map<string, NonNullable<typeof reviews>[number]>();
  for (const r of reviews ?? []) if (!latest.has(r.run_id)) latest.set(r.run_id, r);

  const trainings = (weeks ?? [])
    .flatMap((w) => (trainingList.safeParse(w.trainings).data ?? []).map((t) => ({ teamId: w.team_id, ...t })))
    .filter((t) => t.date >= from && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));
  const done = new Set((loads ?? []).map((l) => `${l.team_id}:${l.session_date}`));

  return {
    trainings: trainings.map((t) => ({ ...t, done: done.has(`${t.teamId}:${t.date}`) })),
    evaluations: evaluations ?? [],
    goals: goals ?? [],
    playerGoals: playerGoals ?? [],
    reviews: (runs ?? []).flatMap((r) => {
      const review = latest.get(r.id);
      const weekStart = (r.week_plans as unknown as { week_start: string }).week_start;
      return review ? [{ ...review, teamId: r.team_id, weekStart }] : [];
    }),
  };
}

export type Development = NonNullable<Awaited<ReturnType<typeof loadDevelopment>>>;

/** Recurring attention points of the evaluations, with names from /staff. */
export function recurring(evaluations: Development["evaluations"]) {
  return recurringPoints(evaluations, staff.evaluation);
}
