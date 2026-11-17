"use server";

import { BANK_MEDIA_BUCKET } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { BANK_TEXT_MAX, parseBank, parseBankText } from "@/lib/exercise-bank/import";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const e = messages.exerciseBank.admin.errors;

export type BankImportResult = {
  counts?: {
    added: number;
    updated: number;
    unchanged: number;
    skipped: number;
  };
  error?: string;
};

/** Imports the backup (the text of the JSON file); invalid exercises are skipped. */
export async function importBank(text: string): Promise<BankImportResult> {
  if (typeof text !== "string" || text.length > BANK_TEXT_MAX)
    return { error: e.file };
  const parsed = parseBankText(text);
  if (!parsed || parsed.exercises.length === 0) return { error: e.file };
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.import };
  const { data, error } = await supabase.rpc("admin_import_bank_exercises", {
    p_exercises: JSON.parse(JSON.stringify(parsed.exercises)),
  });
  if (error || !data) {
    console.error("importBank failed", error);
    return { error: e.import };
  }
  revalidatePath("/admin/exercise-bank");
  return {
    counts: {
      ...(data as { added: number; updated: number; unchanged: number }),
      skipped: parsed.issues.length,
    },
  };
}

/** Approves an exercise, or puts it back to review. */
export async function setBankStatus(
  id: string,
  status: "review" | "approved",
): Promise<{ error?: string }> {
  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["review", "approved"]) })
    .safeParse({ id, status });
  if (!parsed.success) return { error: e.status };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_bank_exercise_status", {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) {
    console.error("setBankStatus failed", error);
    return { error: e.status };
  }
  revalidatePath("/admin/exercise-bank");
  return {};
}

const MEDIA_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};
/** Same limit as the bucket. */
const MEDIA_MAX_BYTES = 25 * 1024 * 1024;
const mediaKey = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);

/**
 * A signed URL to upload a drawing or video of the bank straight from the
 * browser; the file is stored as <code>.<ext> (an existing one is replaced).
 */
export async function prepareBankMediaUpload(
  key: string,
  file: { type: string; size: number },
): Promise<{ path: string; token: string } | { error: string }> {
  const ext = MEDIA_TYPES[file.type];
  if (!mediaKey.safeParse(key).success || !ext) return { error: e.mediaType };
  if (file.size <= 0 || file.size > MEDIA_MAX_BYTES) return { error: e.mediaSize };
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.media };
  const path = `${key}.${ext}`;
  const { data, error } = await supabase.storage.from(BANK_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    console.error("prepareBankMediaUpload failed", error);
    return { error: e.media };
  }
  return { path, token: data.token };
}

/** Links an uploaded file to the exercises with that code. */
export async function saveBankMedia(key: string, path: string): Promise<{ linked?: number; error?: string }> {
  if (!mediaKey.safeParse(key).success || !path.startsWith(`${key}.`) || !Object.values(MEDIA_TYPES).includes(path.slice(key.length + 1))) {
    return { error: e.media };
  }
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_bank_media", { p_media_key: key, p_path: path });
  if (error) {
    console.error("saveBankMedia failed", error);
    return { error: e.media };
  }
  revalidatePath("/admin/exercise-bank");
  return { linked: data ?? 0 };
}

/** Text fields of the edit form; list fields have one item per line. */
const TEXT_FIELDS = ["titel", "type", "spelfase", "doelgroep", "hoofddoel", "aantal_spelers", "duur", "veldafmeting", "belasting", "belasting_toelichting", "regels", "makkelijker", "moeilijker"] as const;
const LIST_FIELDS = ["subdoelen", "principes", "organisatie", "verloop", "coachingspunten", "materiaal"] as const;

export type BankEditState = { ok?: true; error?: string };

/**
 * Saves a correction of a bank exercise. The edited fields are merged into
 * the exercise and checked with the same rules as an import.
 */
export async function updateBankExercise(number: string, _prev: BankEditState, formData: FormData): Promise<BankEditState> {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.edit };
  const { data: row } = await supabase
    .from("bank_exercises")
    .select("id, number, title, kind, phase, target_group, content, media_kind, media_key")
    .eq("number", number)
    .maybeSingle();
  if (!row) return { error: e.edit };
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const lines = (key: string) => text(key).split("\n").map((l) => l.trim()).filter(Boolean);
  const record: Record<string, unknown> = {
    ...(row.content as Record<string, unknown>),
    nummer: row.number,
    diagram: row.media_key,
    diagram_type: row.media_kind,
    ...Object.fromEntries(TEXT_FIELDS.map((key) => [key, text(key)])),
    ...Object.fromEntries(LIST_FIELDS.map((key) => [key, lines(key)])),
    tags: text("tags").split(",").map((t) => t.trim()).filter(Boolean),
  };
  const parsed = parseBank([record]);
  const exercise = parsed?.exercises[0];
  if (!exercise) return { error: e.editInvalid(parsed?.issues[0]?.field ?? "") };
  const { error } = await supabase.rpc("admin_update_bank_exercise", {
    p_id: row.id,
    p_title: exercise.title,
    p_kind: exercise.kind,
    p_phase: exercise.phase,
    p_target_group: exercise.target_group,
    p_tags: exercise.tags,
    p_principles: exercise.principles,
    p_content: JSON.parse(JSON.stringify(exercise.content)),
  });
  if (error) {
    console.error("updateBankExercise failed", error);
    return { error: e.edit };
  }
  revalidatePath("/admin/exercise-bank");
  revalidatePath(`/exercises/bank/${row.number}`);
  return { ok: true };
}
