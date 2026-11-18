import { BANK_MEDIA_BUCKET } from "@iassistent/db";

import { mediaKeyOf } from "@/lib/exercise-bank/zip";
import { messages } from "@/lib/messages";
import type { createBrowserSupabase } from "@/lib/supabase/browser";

import { prepareBankMediaUpload, saveBankMedia } from "./actions";

const m = messages.exerciseBank.admin;

/**
 * Uploads one drawing or video of the bank straight to storage (signed upload
 * URL) and links it to the exercises with its code (the file name).
 */
export async function uploadBankMediaFile(
  supabase: ReturnType<typeof createBrowserSupabase>,
  file: File,
): Promise<{ linked: number } | { error: string }> {
  const key = mediaKeyOf(file.name);
  const prepared = await prepareBankMediaUpload(key, { type: file.type, size: file.size });
  if ("error" in prepared) return { error: prepared.error };
  const { error } = await supabase.storage
    .from(BANK_MEDIA_BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type, upsert: true });
  if (error) return { error: m.errors.media };
  const saved = await saveBankMedia(key, prepared.path);
  return saved.error ? { error: saved.error } : { linked: saved.linked ?? 0 };
}
