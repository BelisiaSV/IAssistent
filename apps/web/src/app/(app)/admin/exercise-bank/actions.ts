"use server";

import { BANK_MEDIA_BUCKET } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { BANK_TEXT_MAX, parseBankText } from "@/lib/exercise-bank/import";
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
