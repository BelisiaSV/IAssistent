"use server";

import { BANK_MEDIA_BUCKET, EXERCISE_VIDEOS_BUCKET } from "@iassistent/db";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { bankToExercise } from "@/lib/exercise-bank/copy";
import type { BankRow } from "@/lib/exercise-bank/staff";
import { BANK_COLUMNS } from "@/lib/exercise-bank/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Takes an approved bank exercise over into the coach's own library (once);
 * opens the own exercise, where the coach can change it.
 */
export async function copyBankExercise(formData: FormData) {
  const number = z.string().regex(/^[A-Za-z]{1,10}-[0-9]{1,6}$/).safeParse(formData.get("number"));
  if (!number.success) redirect("/exercises/bank");
  const user = await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("exercises").select("id").eq("bank_number", number.data).maybeSingle();
  if (existing) redirect(`/exercises/${existing.id}`);
  const { data: row } = await supabase.from("bank_exercises").select(BANK_COLUMNS).eq("number", number.data).maybeSingle();
  if (!row) redirect("/exercises/bank");
  const { data, error } = await supabase.from("exercises").insert(bankToExercise(row as BankRow)).select("id").single();
  if (error || !data) {
    console.error("copyBankExercise failed", error);
    redirect(`/exercises/bank/${number.data}?fout=1`);
  }
  // The video of the bank exercise goes along (a drawing stays in the bank: an own
  // exercise has an animation or a video). Without it, the exercise is still made.
  const bank = row as BankRow;
  if (bank.media_kind === "video" && bank.media_path) {
    const path = `${user.id}/${data.id}/${bank.media_path}`;
    const { error: copyError } = await supabase.storage
      .from(BANK_MEDIA_BUCKET)
      .copy(bank.media_path, path, { destinationBucket: EXERCISE_VIDEOS_BUCKET });
    if (copyError) console.error("copyBankExercise: video not copied", copyError);
    else await supabase.from("exercises").update({ video_path: path }).eq("id", data.id);
  }
  redirect(`/exercises/${data.id}`);
}
