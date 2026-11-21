import "server-only";

import type { QualityReviewRow } from "@/components/quality/quality-review";
import { addDays, mondayOf, todayInBelgium } from "@/lib/weeks/dates";

import type { getClubContext } from "./load";

type Ctx = Awaited<ReturnType<typeof getClubContext>>;

export interface DashboardTeam {
  id: string;
  name: string;
  ageCategory: string;
  archived: boolean;
  staff: { id: string; coachId: string; name: string; role: string }[];
  weekApproved: boolean;
  /** Training Quality Engine: the latest check of this week's approved version. */
  quality: QualityReviewRow | null;
  lastEvaluation: string | null;
  sessions28: number;
}

export interface DashboardData {
  teams: DashboardTeam[];
  trainers: number;
  seatsUsed: number | null;
  pendingLinks: number;
  recent: {
    kind: "week" | "evaluation";
    teamName: string;
    date: string;
    at: string;
  }[];
}

/**
 * What the club dashboard shows, limited to what the user may read: the
 * owner, admin and technical director see every team of the club, a
 * coordinator or coach only their own.
 */
export async function loadClubDashboard(ctx: Ctx): Promise<DashboardData> {
  const { supabase, club } = ctx;
  const today = todayInBelgium();
  const monday = mondayOf(today);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, age_category, archived_at")
    .eq("club_id", club.id)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("name");
  const teamIds = (teams ?? []).map((t) => t.id);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  const [
    { data: staff },
    { data: weeks },
    { data: reports },
    { data: loads },
    seats,
    links,
  ] = await Promise.all([
    supabase
      .from("team_staff")
      .select("id, team_id, coach_id, role")
      .eq("club_id", club.id)
      .is("ended_at", null),
    teamIds.length
      ? supabase
          .from("week_plans")
          .select("id, team_id, week_start")
          .in("team_id", teamIds)
          .gte("week_start", addDays(monday, -56))
      : Promise.resolve({
          data: [] as { id: string; team_id: string; week_start: string }[],
        }),
    teamIds.length
      ? supabase
          .from("match_reports")
          .select("team_id, match_date, created_at")
          .in("team_id", teamIds)
          .order("match_date", { ascending: false })
          .limit(200)
      : Promise.resolve({
          data: [] as {
            team_id: string;
            match_date: string;
            created_at: string;
          }[],
        }),
    teamIds.length
      ? supabase
          .from("session_loads")
          .select("team_id")
          .in("team_id", teamIds)
          .gte("session_date", addDays(today, -28))
      : Promise.resolve({ data: [] as { team_id: string }[] }),
    ctx.canManage
      ? supabase.rpc("club_seats_used", { p_club_id: club.id })
      : Promise.resolve({ data: null }),
    ctx.canManage
      ? supabase.rpc("club_pending_links", { p_club_id: club.id })
      : Promise.resolve({ data: [] }),
  ]);

  const weekIds = (weeks ?? []).map((w) => w.id);
  const { data: runs } = weekIds.length
    ? await supabase
        .from("staff_runs")
        .select("id, week_plan_id, decided_at")
        .in("week_plan_id", weekIds)
        .eq("kind", "week")
        .eq("status", "approved")
        .is("deleted_at", null)
    : { data: [] as { id: string; week_plan_id: string; decided_at: string | null }[] };

  const coachIds = [...new Set((staff ?? []).map((s) => s.coach_id))];
  const { data: coaches } = coachIds.length
    ? await supabase
        .from("coaches")
        .select("id, full_name, email")
        .in("id", coachIds)
    : { data: [] };
  const coachName = new Map(
    (coaches ?? []).map((c) => [c.id, c.full_name ?? c.email]),
  );

  const weekById = new Map((weeks ?? []).map((w) => [w.id, w]));
  // The quality check of each approved version of this week.
  const thisWeekRuns = (runs ?? []).filter((r) => weekById.get(r.week_plan_id)?.week_start === monday);
  const { data: reviews } = thisWeekRuns.length
    ? await supabase
        .from("training_quality_reviews")
        .select("run_id, team_id, status, output, average, verdict, created_at")
        .in("run_id", thisWeekRuns.map((r) => r.id))
        .eq("status", "ready")
        .order("created_at", { ascending: false })
    : { data: [] };
  const approvedThisWeek = new Set(
    (runs ?? [])
      .map((r) => weekById.get(r.week_plan_id))
      .filter((w) => w?.week_start === monday)
      .map((w) => w!.team_id),
  );

  const result: DashboardTeam[] = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    ageCategory: t.age_category,
    archived: !!t.archived_at,
    staff: (staff ?? [])
      .filter((s) => s.team_id === t.id)
      .map((s) => ({
        id: s.id,
        coachId: s.coach_id,
        name: coachName.get(s.coach_id) ?? "—",
        role: s.role,
      }))
      .sort((a, b) => a.role.localeCompare(b.role)),
    weekApproved: approvedThisWeek.has(t.id),
    quality: (reviews ?? []).find((q) => q.team_id === t.id) ?? null,
    lastEvaluation:
      (reports ?? []).find((r) => r.team_id === t.id)?.match_date ?? null,
    sessions28: (loads ?? []).filter((l) => l.team_id === t.id).length,
  }));

  const recent = [
    ...(runs ?? []).flatMap((r) => {
      const w = weekById.get(r.week_plan_id);
      return w && r.decided_at
        ? [
            {
              kind: "week" as const,
              teamName: teamName.get(w.team_id) ?? "",
              date: w.week_start,
              at: r.decided_at,
            },
          ]
        : [];
    }),
    ...(reports ?? []).slice(0, 20).map((r) => ({
      kind: "evaluation" as const,
      teamName: teamName.get(r.team_id) ?? "",
      date: r.match_date,
      at: r.created_at,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);

  return {
    teams: result,
    trainers: new Set(
      (staff ?? [])
        .filter((s) => s.role !== "coordinator")
        .map((s) => s.coach_id),
    ).size,
    seatsUsed: typeof seats.data === "number" ? seats.data : null,
    pendingLinks: Array.isArray(links.data) ? links.data.length : 0,
    recent,
  };
}
