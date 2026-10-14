"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { addDays, isIsoDate, mondayOf, todayInBelgium } from "@/lib/weeks/dates";
import { trainingScheduleSchema, type WeekTraining } from "@/lib/weeks/validation";

export type FormState = { error?: string; success?: string };

const e = messages.weeks.errors;
const s = messages.settings;
const uuid = z.uuid();

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return undefined;
  }
}

/**
 * Saves the fixed training days of the team. Optionally also for the weeks
 * from this week on that are open but have no week document yet.
 */
export async function saveTrainingSchedule(
  teamId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const parsed = trainingScheduleSchema.safeParse(parseJson(formData.get("schedule")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };
  const applyToOpenWeeks = formData.get("applyToOpenWeeks") === "1";

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

  let updated = 0;
  if (applyToOpenWeeks) {
    const { data: weeks } = await supabase
      .from("week_plans")
      .select("id, week_start, matches, staff_runs(id)")
      .eq("team_id", teamId)
      .gte("week_start", mondayOf(todayInBelgium()));
    for (const week of weeks ?? []) {
      if (week.staff_runs?.length) continue;
      const matchDates = new Set(((week.matches ?? []) as { date: string }[]).map((m) => m.date));
      const trainings: WeekTraining[] = schedule
        .map((slot) => ({ date: addDays(week.week_start, slot.weekday - 1), start: slot.start, duration_min: slot.duration_min }))
        .filter((t) => !matchDates.has(t.date));
      const { error: weekError } = await supabase.from("week_plans").update({ trainings }).eq("id", week.id);
      if (weekError) console.error("saveTrainingSchedule: week", weekError);
      else updated++;
    }
  }

  revalidatePath(`/teams/${teamId}`, "layout");
  return { success: updated ? s.schedule.savedWithWeeks(updated) : s.schedule.saved };
}

const optionalDate = z.union([z.literal("").transform(() => null), z.string().refine(isIsoDate, e.date)]);
const cycle = z.coerce.number().refine((n) => [4, 6, 8].includes(n), e.cycle);
const seasonSchema = z
  .object({
    preparationStartDate: optionalDate,
    preparationWeeks: cycle,
    competitionStartDate: optionalDate,
    competitionWeeks: cycle,
  })
  .refine(
    (v) => !v.preparationStartDate || !v.competitionStartDate || v.preparationStartDate < v.competitionStartDate,
    { message: s.season.order, path: ["preparationStartDate"] },
  );

/** Saves the season planning: preparation and competition, each with its cycle. */
export async function saveSeasonSettings(
  teamId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const parsed = seasonSchema.safeParse({
    preparationStartDate: String(formData.get("preparationStartDate") ?? ""),
    preparationWeeks: formData.get("preparationWeeks"),
    competitionStartDate: String(formData.get("competitionStartDate") ?? ""),
    competitionWeeks: formData.get("competitionWeeks"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };

  await requireUser();
  const supabase = await createClient();
  const v = parsed.data;
  const { data, error } = await supabase
    .from("teams")
    .update({
      preparation_start_date: v.preparationStartDate,
      preparation_weeks: v.preparationWeeks,
      competition_start_date: v.competitionStartDate,
      periodization_weeks: v.competitionWeeks,
    })
    .eq("id", teamId)
    .select("id");
  if (error || !data?.length) {
    console.error("saveSeasonSettings failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(`/teams/${teamId}`, "layout");
  return { success: s.season.saved };
}
