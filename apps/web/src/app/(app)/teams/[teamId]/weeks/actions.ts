"use server";

import { FEATURE_FLAGS, type Json } from "@iassistent/db";
import { runRole, StaffGenerationError } from "@iassistent/staff-engine";
import type { VisionAnswers } from "@iassistent/staff-engine/content";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { getStaffProvider } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { messages } from "@/lib/messages";
import { staff, visionQuestionnaire, matchDayCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { buildRoleContext } from "@/lib/weeks/context";
import { addDays, isIsoDate, isoWeekday } from "@/lib/weeks/dates";
import {
  trainingScheduleSchema,
  type WeekMatch,
  weekPlanSchema,
  type WeekTraining,
} from "@/lib/weeks/validation";

export type FormState = { error?: string; success?: string };

const ROLE = "assistant-coach";
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

export async function saveTrainingSchedule(
  teamId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const parsed = trainingScheduleSchema.safeParse(parseJson(formData.get("schedule")));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await requireUser();
  const supabase = await createClient();
  const schedule = [...parsed.data].sort((a, b) => a.weekday - b.weekday);
  const { data, error } = await supabase
    .from("teams")
    .update({ training_schedule: schedule })
    .eq("id", teamId)
    .select("id");
  if (error || !data?.length) {
    console.error("saveTrainingSchedule failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(`/teams/${teamId}/weeks`);
  return { success: messages.weeks.schedule.saved };
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
  revalidatePath(weekPath(teamId, weekStart));
  return { success: messages.weeks.input.saved };
}

/**
 * Asks the Assistant Coach for a (new version of the) week planning. The
 * proposal row is created right away; the role runs after the response.
 */
export async function requestProposal(
  teamId: string,
  weekStart: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success || !isMonday(weekStart)) return { error: e.invalidWeek };
  const feedback = String(formData.get("feedback") ?? "").trim();
  const isAdjustment = formData.get("adjust") === "1";
  if (isAdjustment && !feedback) return { error: pe.feedbackRequired };
  if (feedback.length > 2000) return { error: pe.feedbackTooLong };

  const user = await requireUser();
  if (!(await isFeatureEnabled(FEATURE_FLAGS.assistantCoach))) return { error: messages.proposals.flagOff };

  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("*")
    .eq("team_id", teamId)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) return { error: pe.noWeek };

  const [{ data: players }, { data: profile }, { data: previous }] = await Promise.all([
    supabase.from("players").select("*").eq("team_id", teamId),
    supabase.from("coach_profiles").select("vision_summary, vision").eq("coach_id", user.id).maybeSingle(),
    supabase
      .from("staff_proposals")
      .select("output")
      .eq("week_plan_id", week.id)
      .eq("role", ROLE)
      .in("status", ["ready", "approved"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const parsedWeek = weekPlanSchema(weekStart).safeParse({
    trainings: week.trainings,
    matches: week.matches,
    previousMatchDate: week.previous_match_date,
    notes: week.notes ?? "",
  });
  if (!parsedWeek.success) return { error: firstIssue(parsedWeek.error) };

  const context = buildRoleContext({
    weekStart,
    trainings: parsedWeek.data.trainings,
    matches: parsedWeek.data.matches,
    previousMatchDate: parsedWeek.data.previousMatchDate,
    notes: parsedWeek.data.notes,
    players: players ?? [],
    visionSummary: profile?.vision_summary ?? null,
    visionAnswers: ((profile?.vision ?? {}) as { antwoorden?: VisionAnswers }).antwoorden ?? {},
    questionnaire: visionQuestionnaire,
    matchDays: matchDayCatalog,
    feedback: feedback && previous?.output ? { previousOutput: previous.output, comment: feedback } : null,
  });

  const provider = getStaffProvider();
  const { data: proposal, error } = await supabase
    .from("staff_proposals")
    .insert({
      team_id: teamId,
      week_plan_id: week.id,
      role: ROLE,
      provider: provider.id,
      feedback: feedback || null,
    })
    .select("id, version")
    .single();

  if (error || !proposal) {
    console.error("requestProposal failed", error);
    return { error: error?.hint === "daily_limit_reached" ? pe.dailyLimit : pe.requestFailed };
  }

  // Run the role after the response is sent; the page polls until it is done.
  after(async () => {
    try {
      const result = await runRole(staff, ROLE, context, provider);
      const { error: updateError } = await supabase
        .from("staff_proposals")
        .update({
          status: "ready",
          output: result.output as Json,
          model: result.model,
          usage: result.usage as Json,
          content_version: result.contentVersion,
        })
        .eq("id", proposal.id);
      if (updateError) throw updateError;
    } catch (cause) {
      console.error("staff proposal generation failed", cause);
      const detail =
        cause instanceof StaffGenerationError ? `${cause.code}: ${cause.message}` : String(cause);
      await supabase
        .from("staff_proposals")
        .update({ status: "failed", error: detail.slice(0, 2000) })
        .eq("id", proposal.id);
    }
  });

  revalidatePath(weekPath(teamId, weekStart));
  redirect(`${weekPath(teamId, weekStart)}?v=${proposal.version}`);
}

export async function decideProposal(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const weekStart = String(formData.get("weekStart"));
  const proposalId = String(formData.get("proposalId"));
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(proposalId).success || !isMonday(weekStart)) return;

  await requireUser();
  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("staff_proposals")
    .select("id, week_plan_id, role, status")
    .eq("id", proposalId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!proposal || !["ready", "approved", "rejected"].includes(proposal.status)) return;

  if (decision === "approved") {
    // Only one approved version per week and role.
    await supabase
      .from("staff_proposals")
      .update({ status: "ready", decided_at: null })
      .eq("week_plan_id", proposal.week_plan_id)
      .eq("role", proposal.role)
      .eq("status", "approved");
  }
  const { error } = await supabase
    .from("staff_proposals")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", proposal.id);
  if (error) console.error("decideProposal failed", error);
  revalidatePath(weekPath(teamId, weekStart));
}
