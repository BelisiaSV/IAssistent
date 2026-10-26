"use server";

import { EXERCISE_VIDEOS_BUCKET, type Json } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { parseAnimation } from "@/lib/animation/schema";
import { exerciseFormSchema, VIDEO_MAX_BYTES, VIDEO_TYPES, videoExtension } from "@/lib/exercises/validation";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export type ExerciseFormState = { error?: string; success?: string };

const e = messages.exercises.errors;
const media = messages.exercises.media;
const uuid = z.uuid();
const path = (id?: string) => `/exercises${id ? `/${id}` : ""}`;

function parseForm(formData: FormData) {
  return exerciseFormSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    phase: String(formData.get("phase") ?? ""),
    labels: String(formData.get("labels") ?? ""),
    minPlayers: String(formData.get("minPlayers") ?? ""),
    maxPlayers: String(formData.get("maxPlayers") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    sets: String(formData.get("sets") ?? ""),
    workMin: String(formData.get("workMin") ?? "").trim(),
    restMin: String(formData.get("restMin") ?? "").trim(),
    intensity: String(formData.get("intensity") ?? ""),
    rpe: String(formData.get("rpe") ?? ""),
    useInPlanning: formData.get("useInPlanning") === "on",
    organisation: String(formData.get("organisation") ?? ""),
    course: String(formData.get("course") ?? ""),
    coaching: String(formData.get("coaching") ?? ""),
    variations: String(formData.get("variations") ?? ""),
  });
}

function columns(v: NonNullable<ReturnType<typeof parseForm>["data"]>) {
  return {
    title: v.title,
    phase: v.phase,
    labels: v.labels,
    min_players: v.minPlayers,
    max_players: v.maxPlayers,
    duration_min: v.duration,
    sets: v.sets,
    work_min: v.workMin,
    rest_min: v.restMin,
    intensity: v.intensity,
    rpe: v.rpe,
    use_in_planning: v.useInPlanning,
    organisation: v.organisation,
    course: v.course,
    coaching_points: v.coaching,
    variations: v.variations,
  };
}

export async function createExercise(_prev: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").insert(columns(parsed.data)).select("id").single();
  if (error || !data) {
    console.error("createExercise failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(path());
  redirect(path(data.id));
}

export async function updateExercise(exerciseId: string, _prev: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  if (!uuid.safeParse(exerciseId).success) return { error: e.saveFailed };
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("exercises").update(columns(parsed.data)).eq("id", exerciseId).select("id");
  if (error || !data?.length) {
    console.error("updateExercise failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(path(exerciseId));
  redirect(path(exerciseId));
}

export async function deleteExercise(formData: FormData) {
  const exerciseId = String(formData.get("exerciseId"));
  if (!uuid.safeParse(exerciseId).success) return;
  await requireUser();
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("video_path").eq("id", exerciseId).maybeSingle();
  if (!exercise) return;
  if (exercise.video_path) await supabase.storage.from(EXERCISE_VIDEOS_BUCKET).remove([exercise.video_path]);
  const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
  if (error) {
    console.error("deleteExercise failed", error);
    return;
  }
  revalidatePath(path());
  redirect(path());
}

/** Imports an animation file (.json in the app format). */
export async function importAnimation(exerciseId: string, _prev: ExerciseFormState, formData: FormData): Promise<ExerciseFormState> {
  if (!uuid.safeParse(exerciseId).success) return { error: e.saveFailed };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) return { error: media.animationInvalid };
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { error: media.animationInvalid };
  }
  const animation = parseAnimation(raw);
  if (!animation) return { error: media.animationInvalid };

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ animation: animation as unknown as Json })
    .eq("id", exerciseId)
    .select("id");
  if (error || !data?.length) {
    console.error("importAnimation failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(path(exerciseId));
  return { success: media.animationSaved };
}

export async function removeAnimation(formData: FormData) {
  const exerciseId = String(formData.get("exerciseId"));
  if (!uuid.safeParse(exerciseId).success) return;
  await requireUser();
  const supabase = await createClient();
  await supabase.from("exercises").update({ animation: null }).eq("id", exerciseId);
  revalidatePath(path(exerciseId));
}

/**
 * Prepares a direct upload of a video to storage (too big for a server action):
 * returns a signed upload URL for <coach>/<exercise>/<random>.<ext>.
 */
export async function prepareVideoUpload(
  exerciseId: string,
  file: { type: string; size: number },
): Promise<{ path: string; token: string } | { error: string }> {
  const ext = videoExtension(file.type);
  if (!uuid.safeParse(exerciseId).success || !ext || !VIDEO_TYPES.includes(file.type as (typeof VIDEO_TYPES)[number]) || file.size <= 0 || file.size > VIDEO_MAX_BYTES) {
    return { error: media.videoInvalid };
  }
  const user = await requireUser();
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("id").eq("id", exerciseId).maybeSingle();
  if (!exercise) return { error: e.saveFailed };
  const objectPath = `${user.id}/${exerciseId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(EXERCISE_VIDEOS_BUCKET).createSignedUploadUrl(objectPath);
  if (error || !data) {
    console.error("prepareVideoUpload failed", error);
    return { error: e.saveFailed };
  }
  return { path: objectPath, token: data.token };
}

/** Links an uploaded video to the exercise and removes the previous one. */
export async function attachVideo(exerciseId: string, objectPath: string): Promise<ExerciseFormState> {
  if (!uuid.safeParse(exerciseId).success) return { error: e.saveFailed };
  const user = await requireUser();
  if (!objectPath.startsWith(`${user.id}/${exerciseId}/`)) return { error: e.saveFailed };
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("video_path").eq("id", exerciseId).maybeSingle();
  if (!exercise) return { error: e.saveFailed };
  const { error } = await supabase.from("exercises").update({ video_path: objectPath }).eq("id", exerciseId);
  if (error) {
    console.error("attachVideo failed", error);
    return { error: e.saveFailed };
  }
  if (exercise.video_path && exercise.video_path !== objectPath) {
    await supabase.storage.from(EXERCISE_VIDEOS_BUCKET).remove([exercise.video_path]);
  }
  revalidatePath(path(exerciseId));
  return { success: media.videoSaved };
}

export async function removeVideo(formData: FormData) {
  const exerciseId = String(formData.get("exerciseId"));
  if (!uuid.safeParse(exerciseId).success) return;
  await requireUser();
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("video_path").eq("id", exerciseId).maybeSingle();
  if (!exercise?.video_path) return;
  await supabase.storage.from(EXERCISE_VIDEOS_BUCKET).remove([exercise.video_path]);
  await supabase.from("exercises").update({ video_path: null }).eq("id", exerciseId);
  revalidatePath(path(exerciseId));
}
