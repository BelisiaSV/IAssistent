"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const e = messages.development.errors;
const uuid = z.uuid();
const STATUSES = ["open", "on_track", "at_risk", "achieved", "dropped"] as const;
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const path = (teamId: string) => `/teams/${teamId}/development`;

async function client() {
  await requireUser();
  return createClient();
}

const evaluationSchema = z.object({
  rating: z.union([z.literal("").transform(() => null), z.coerce.number().int().min(1).max(5)]),
  went_well: text(1000),
  to_improve: text(1000),
  attention_points: z.array(z.string().regex(/^[a-z][a-z_]{0,39}$/)).max(10),
});

/** The head coach evaluates the training of one day (one per day; saving again changes it). */
export async function saveTrainingEvaluation(teamId: string, date: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = evaluationSchema.safeParse({
    rating: formData.get("rating") ?? "",
    went_well: formData.get("wentWell") ?? "",
    to_improve: formData.get("toImprove") ?? "",
    attention_points: [...new Set(formData.getAll("points").map(String))],
  });
  if (!parsed.success || !uuid.safeParse(teamId).success || !z.iso.date().safeParse(date).success) return { error: e.invalid };
  const supabase = await client();
  const { error } = await supabase
    .from("training_evaluations")
    .upsert({ team_id: teamId, session_date: date, ...parsed.data }, { onConflict: "team_id,session_date" });
  if (error) {
    console.error("saveTrainingEvaluation failed", error);
    return { error: e.failed };
  }
  revalidatePath(path(teamId));
  return { ok: messages.development.saved };
}

const goalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: text(1000),
  target_date: z.union([z.literal("").transform(() => null), z.iso.date()]),
  status: z.enum(STATUSES),
  progress: z.coerce.number().int().min(0).max(100),
});

function goalFrom(formData: FormData) {
  return goalSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    target_date: formData.get("targetDate") ?? "",
    status: formData.get("status") ?? "open",
    progress: formData.get("progress") ?? 0,
  });
}

/** Create (goalId null) or change a team goal; every change of status or progress goes into its history. */
export async function saveTeamGoal(teamId: string, goalId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = goalFrom(formData);
  if (!parsed.success || !uuid.safeParse(teamId).success) return { error: e.invalid };
  const supabase = await client();
  const { error } = goalId
    ? await supabase.from("team_goals").update(parsed.data).eq("id", goalId).eq("team_id", teamId)
    : await supabase.from("team_goals").insert({ team_id: teamId, ...parsed.data });
  if (error) {
    console.error("saveTeamGoal failed", error);
    return { error: e.failed };
  }
  revalidatePath(path(teamId));
  return { ok: messages.development.saved };
}

/** Create or change a development goal of a player (only when the team switched them on). */
export async function savePlayerGoal(teamId: string, goalId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = goalFrom(formData);
  const player = String(formData.get("playerId") ?? "");
  if (!parsed.success || !uuid.safeParse(teamId).success || !uuid.safeParse(player).success) return { error: e.invalid };
  const { description, ...goal } = parsed.data;
  const supabase = await client();
  const row = { ...goal, note: description, player_id: player };
  const { error } = goalId
    ? await supabase.from("player_goals").update(row).eq("id", goalId).eq("team_id", teamId)
    : await supabase.from("player_goals").insert({ team_id: teamId, ...row });
  if (error) {
    console.error("savePlayerGoal failed", error);
    return { error: error.hint === "player_goals_off" ? e.off : e.failed };
  }
  revalidatePath(path(teamId));
  return { ok: messages.development.saved };
}

export async function deleteGoal(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const table = formData.get("kind") === "player" ? "player_goals" : "team_goals";
  const supabase = await client();
  const { error } = await supabase.from(table).delete().eq("id", String(formData.get("goalId"))).eq("team_id", teamId);
  if (error) console.error("deleteGoal failed", error);
  revalidatePath(path(teamId));
}

/** Switch the development goals per player on or off for the team. */
export async function setPlayerGoals(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  if (!uuid.safeParse(teamId).success) return;
  const supabase = await client();
  const { error } = await supabase
    .from("teams")
    .update({ player_goals_enabled: formData.get("enabled") === "1" })
    .eq("id", teamId);
  if (error) console.error("setPlayerGoals failed", error);
  revalidatePath(path(teamId));
}
