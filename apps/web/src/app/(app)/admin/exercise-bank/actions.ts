"use server";

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
