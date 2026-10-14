"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { opponentKey } from "@/lib/opponents/context";
import { matchReportSchema } from "@/lib/opponents/validation";
import { lineupFromMatchPlan } from "@/lib/proposals/lineup";
import type { MatchPrepOutput } from "@/lib/proposals/types";
import { RUN_STEPS } from "@/lib/roles";
import { matchPrepFrom } from "@/lib/staff-runs/gate";
import { advanceRun, decideRun, RunRequestError, startRun } from "@/lib/staff-runs/server";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { addDays, isIsoDate, isoWeekday, longDate, todayInBelgium } from "@/lib/weeks/dates";
import { loadWeek } from "@/lib/weeks/load";
import { SEASON_TEAM_COLUMNS } from "@/lib/weeks/season";
import {
  trainingScheduleSchema,
  type WeekMatch,
  weekPlanSchema,
  type WeekTraining,
} from "@/lib/weeks/validation";

export type FormState = { error?: string; success?: string };

const e = messages.weeks.errors;
const pe = messages.proposals.errors;
const uuid = z.uuid();

const weekPath = (teamId: string, weekStart: string) => `/teams/${teamId}/weeks/${weekStart}`;
const isMonday = (value: string) => isIsoDate(value) && isoWeekday(value) === 1;

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return undefined;
  }
}

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? e.saveFailed;
}

/** Opens (or creates) the week, prefilled from the standard training schedule. */
export async function openWeek(teamId: string, formData: FormData) {
  const weekStart = String(formData.get("weekStart") ?? "");
  if (!uuid.safeParse(teamId).success || !isMonday(weekStart)) return;

  await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("week_plans")
    .select("id")
    .eq("team_id", teamId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!existing) {
    const [{ data: team }, { data: previous }] = await Promise.all([
      supabase.from("teams").select("training_schedule").eq("id", teamId).single(),
      supabase
        .from("week_plans")
        .select("matches")
        .eq("team_id", teamId)
        .lt("week_start", weekStart)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const schedule = trainingScheduleSchema.safeParse(team?.training_schedule);
    const trainings: WeekTraining[] = (schedule.success ? schedule.data : []).map((slot) => ({
      date: addDays(weekStart, slot.weekday - 1),
      start: slot.start,
      duration_min: slot.duration_min,
    }));
    const previousMatches = (previous?.matches ?? []) as WeekMatch[];
    const previousMatchDate = previousMatches.map((m) => m.date).sort().at(-1) ?? null;

    const { error } = await supabase.from("week_plans").insert({
      team_id: teamId,
      week_start: weekStart,
      trainings,
      previous_match_date: previousMatchDate,
    });
    if (error && error.code !== "23505") {
      console.error("openWeek failed", error);
      return;
    }
  }
  redirect(weekPath(teamId, weekStart));
}

export async function saveWeekPlan(
  teamId: string,
  weekStart: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success || !isMonday(weekStart)) return { error: e.invalidWeek };
  const parsed = weekPlanSchema(weekStart).safeParse(parseJson(formData.get("week")));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await requireUser();
  const supabase = await createClient();
  const week = parsed.data;
  const { data, error } = await supabase
    .from("week_plans")
    .update({
      trainings: week.trainings,
      matches: week.matches,
      previous_match_date: week.previousMatchDate,
      notes: week.notes,
    })
    .eq("team_id", teamId)
    .eq("week_start", weekStart)
    .select("id");
  if (error || !data?.length) {
    console.error("saveWeekPlan failed", error);
    return { error: e.saveFailed };
  }

  // Every opponent of the week gets a fiche (linked by name).
  if (week.matches.length) {
    const { data: known } = await supabase.from("opponents").select("name").eq("team_id", teamId);
    const existing = new Set((known ?? []).map((o) => opponentKey(o.name)));
    const missing = [...new Map(week.matches.map((m) => [opponentKey(m.opponent), m.opponent.trim()])).entries()]
      .filter(([key]) => !existing.has(key))
      .map(([, name]) => ({ team_id: teamId, name }));
    if (missing.length) {
      const { error: opponentError } = await supabase.from("opponents").insert(missing);
      if (opponentError && opponentError.code !== "23505") console.error("saveWeekPlan: opponents", opponentError);
    }
  }
  revalidatePath(weekPath(teamId, weekStart));
  return { success: messages.weeks.input.saved };
}

const runKind = z.enum(["week", "match"]);

/**
 * The head coach asks the staff once: a week document or a match preparation.
 * With "adjust" a new version is made from the shown one: the whole staff or
 * one step (and the steps that build on it) work again with the feedback.
 */
export async function requestRun(
  teamId: string,
  weekStart: string,
  kind: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsedKind = runKind.safeParse(kind);
  if (!parsedKind.success || !uuid.safeParse(teamId).success || !isMonday(weekStart)) return { error: e.invalidWeek };
  const feedback = String(formData.get("feedback") ?? "").trim();
  const basedOnId = String(formData.get("basedOn") ?? "");
  const retry = formData.get("retry") === "1";
  const feedbackStep = String(formData.get("step") ?? "") || null;
  const isAdjustment = !!basedOnId && !retry;
  if (isAdjustment && !feedback) return { error: pe.feedbackRequired };
  if (feedback.length > 2000) return { error: pe.feedbackTooLong };
  if (feedbackStep && !RUN_STEPS[parsedKind.data].some((s) => s.key === feedbackStep)) return { error: pe.requestFailed };

  const user = await requireUser();
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select(SEASON_TEAM_COLUMNS)
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { error: pe.requestFailed };
  const data = await loadWeek(supabase, team, weekStart);
  if (!data.week) return { error: pe.noWeek };

  if (parsedKind.data === "match") {
    const week = weekPlanSchema(weekStart).safeParse({
      trainings: data.week.trainings,
      matches: data.week.matches,
      previousMatchDate: data.week.previous_match_date,
      notes: data.week.notes ?? "",
    });
    const from = week.success ? matchPrepFrom(week.data.trainings, week.data.matches, weekStart) : null;
    if (!from) return { error: messages.staffRun.match.noMatch };
    if (!data.runs.some((r) => r.kind === "week" && r.status === "approved")) return { error: messages.staffRun.match.needsWeek };
    if (todayInBelgium() < from) return { error: messages.staffRun.match.from(longDate(from)) };
  }

  const basedOn = basedOnId ? (data.runs.find((r) => r.id === basedOnId && r.kind === parsedKind.data) ?? null) : null;
  if (basedOnId && !basedOn) return { error: pe.requestFailed };

  let run;
  try {
    run = await startRun(supabase, {
      teamId,
      weekPlanId: data.week.id,
      kind: parsedKind.data,
      feedback: isAdjustment ? feedback : null,
      feedbackStep: isAdjustment ? feedbackStep : null,
      basedOn,
      retry,
    });
  } catch (cause) {
    if (cause instanceof RunRequestError) {
      if (cause.code === "daily_limit") return { error: pe.dailyLimit };
      if (cause.code === "no_steps") return { error: messages.staffRun.flagOff };
    }
    return { error: pe.requestFailed };
  }

  const work = await advanceRun(supabase, { team, weekStart, runId: run.id, coachId: user.id });
  if (work) after(work);

  revalidatePath(weekPath(teamId, weekStart));
  redirect(`${weekPath(teamId, weekStart)}?${run.kind}=${run.version}#${run.kind}`);
}

/** Called by the page while a run is busy: starts the steps that can go next. */
export async function continueRun(teamId: string, weekStart: string, runId: string) {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(runId).success || !isMonday(weekStart)) return;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: team } = await supabase
    .from("teams")
    .select(SEASON_TEAM_COLUMNS)
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return;
  const work = await advanceRun(supabase, { team, weekStart, runId, coachId: user.id });
  if (work) after(work);
}

const sessionLoadSchema = z.object({
  date: z.string().refine(isIsoDate, e.date),
  kind: z.enum(["training", "match"]),
  rpe: z.union([z.literal(""), z.coerce.number().min(0, e.rpe).max(10, e.rpe)]),
  duration: z.coerce.number().int(e.duration).min(1, e.duration).max(300, e.duration),
  attendance: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(0).max(60)]),
});

/** Stores (or with an empty RPE removes) the actual load of a session. */
export async function saveSessionLoad(
  teamId: string,
  weekStart: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success || !isMonday(weekStart)) return { error: e.invalidWeek };
  const parsed = sessionLoadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const load = parsed.data;

  await requireUser();
  const supabase = await createClient();
  const { error } =
    load.rpe === ""
      ? await supabase.from("session_loads").delete().eq("team_id", teamId).eq("session_date", load.date).eq("kind", load.kind)
      : await supabase.from("session_loads").upsert(
          {
            team_id: teamId,
            session_date: load.date,
            kind: load.kind,
            rpe: load.rpe,
            duration_min: load.duration,
            attendance: load.attendance,
          },
          { onConflict: "team_id,session_date,kind" },
        );
  if (error) {
    console.error("saveSessionLoad failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(weekPath(teamId, weekStart));
  return { success: messages.weeks.load.saved };
}

export async function decideRunAction(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const weekStart = String(formData.get("weekStart"));
  const runId = String(formData.get("runId"));
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(runId).success || !isMonday(weekStart)) return;

  await requireUser();
  const supabase = await createClient();
  const { data: run } = await supabase.from("staff_runs").select("*").eq("id", runId).eq("team_id", teamId).maybeSingle();
  if (!run || !["ready", "approved", "rejected"].includes(run.status)) return;
  await decideRun(supabase, run, decision);
  revalidatePath(weekPath(teamId, weekStart));
}

/** Stores the findings of the head coach after a match of this week. */
export async function saveMatchReport(
  teamId: string,
  weekStart: string,
  matchDate: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const r = messages.matchReport;
  if (!uuid.safeParse(teamId).success || !isMonday(weekStart) || !isIsoDate(matchDate)) return { error: r.errors.saveFailed };
  const parsed = matchReportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await requireUser();
  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("matches")
    .eq("team_id", teamId)
    .eq("week_start", weekStart)
    .maybeSingle();
  const match = ((week?.matches ?? []) as WeekMatch[]).find((m) => m.date === matchDate);
  if (!match) return { error: r.errors.saveFailed };
  const { data: opponent } = await supabase
    .from("opponents")
    .select("id, name")
    .eq("team_id", teamId)
    .ilike("name", match.opponent.trim().replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();

  const report = parsed.data;
  const { error } = await supabase.from("match_reports").upsert(
    {
      team_id: teamId,
      match_date: matchDate,
      opponent_id: opponent?.id ?? null,
      opponent_name: opponent?.name ?? match.opponent,
      home: match.home,
      goals_for: report.goalsFor,
      goals_against: report.goalsAgainst,
      own_formation: report.ownFormation,
      opponent_formation: report.opponentFormation,
      went_well: report.wentWell,
      went_badly: report.wentBadly,
      lessons: report.lessons,
    },
    { onConflict: "team_id,match_date" },
  );
  if (error) {
    console.error("saveMatchReport failed", error);
    return { error: r.errors.saveFailed };
  }
  revalidatePath(weekPath(teamId, weekStart));
  return { success: r.saved };
}

/** Copies the lineup of a Tactical Coach match plan into Selecties (as a draft). */
export async function lineupFromProposal(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const weekStart = String(formData.get("weekStart"));
  const proposalId = String(formData.get("proposalId"));
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(proposalId).success || !isMonday(weekStart)) return;

  await requireUser();
  const supabase = await createClient();
  const [{ data: proposal }, { data: players }, { data: week }] = await Promise.all([
    supabase
      .from("staff_proposals")
      .select("output")
      .eq("id", proposalId)
      .eq("team_id", teamId)
      .eq("role", "tactical-coach")
      .eq("task", "wedstrijdvoorbereiding")
      .maybeSingle(),
    supabase.from("players").select("id, shirt_number, archived_at").eq("team_id", teamId),
    supabase.from("week_plans").select("matches").eq("team_id", teamId).eq("week_start", weekStart).maybeSingle(),
  ]);
  const plan = proposal?.output as MatchPrepOutput | null | undefined;
  const formation = formationCatalog.formaties.find((f) => f.code === plan?.opstelling.formatie);
  if (!plan || !formation) return;

  const match = ((week?.matches ?? []) as WeekMatch[]).toSorted((a, b) => a.date.localeCompare(b.date))[0];
  const { starters, bench } = lineupFromMatchPlan(
    plan.opstelling,
    players ?? [],
    new Set(formation.posten.map((s) => s.id)),
  );
  const { data: lineup, error } = await supabase
    .from("lineups")
    .insert({
      team_id: teamId,
      title: messages.matchPlan.lineupTitle(match?.opponent ?? ""),
      match_date: match?.date ?? null,
      opponent: match?.opponent ?? null,
      formation: formation.code,
      starters,
      bench,
      source: "tactical-coach",
    })
    .select("id")
    .single();
  if (error || !lineup) {
    console.error("lineupFromProposal failed", error);
    return;
  }
  revalidatePath(`/teams/${teamId}/lineups`);
  redirect(`/teams/${teamId}/lineups/${lineup.id}`);
}
