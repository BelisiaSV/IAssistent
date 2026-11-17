"use server";

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
  await requireUser();
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
  redirect(`/exercises/${data.id}`);
}
