"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { sendMessage } from "./actions";

const e = messages.tasksPage.mine.errors;
const uuid = z.uuid();
const title = z.string().trim().min(1).max(300);

export type CoachTaskResult = { ok?: true; error?: string };

const path = (teamId: string) => `/teams/${teamId}/tasks`;

/** Adds a task of the head coach. */
export async function addCoachTask(teamId: string, text: string): Promise<CoachTaskResult> {
  const parsed = title.safeParse(text);
  if (!uuid.safeParse(teamId).success || !parsed.success) return { error: e.title };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_tasks").insert({ team_id: teamId, title: parsed.data });
  if (error) {
    if (error.code !== "42501") console.error("addCoachTask failed", error);
    return { error: error.code === "42501" ? e.readOnly : e.save };
  }
  revalidatePath(path(teamId));
  return { ok: true };
}

/** Ticks a task off (or back on). */
export async function setCoachTaskDone(teamId: string, taskId: string, done: boolean): Promise<CoachTaskResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(taskId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coach_tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("team_id", teamId)
    .select("id");
  if (error || !data?.length) return { error: e.save };
  revalidatePath(path(teamId));
  return { ok: true };
}

/** Removes a task. */
export async function removeCoachTask(teamId: string, taskId: string): Promise<CoachTaskResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(taskId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("coach_tasks").delete().eq("id", taskId).eq("team_id", teamId);
  if (error) return { error: e.save };
  revalidatePath(path(teamId));
  return { ok: true };
}

/**
 * "Vraag aan de staf": the task goes as a question to the chosen role (same
 * route as a message in the Staff Room, player names become shirt numbers).
 * The answer is in the conversation with that role.
 */
export async function askCoachTask(teamId: string, taskId: string, role: string): Promise<CoachTaskResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(taskId).success) return { error: e.ask };
  await requireUser();
  const supabase = await createClient();
  const { data: task } = await supabase.from("coach_tasks").select("id, title").eq("id", taskId).eq("team_id", teamId).maybeSingle();
  if (!task) return { error: e.ask };
  const sent = await sendMessage(teamId, role, task.title);
  if (sent.error) return { error: sent.error };
  await supabase.from("coach_tasks").update({ role, asked_at: new Date().toISOString() }).eq("id", taskId);
  revalidatePath(path(teamId));
  return { ok: true };
}
