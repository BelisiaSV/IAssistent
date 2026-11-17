import "server-only";

import type { BankExercise } from "@iassistent/staff-engine/content";

import type { createClient } from "@/lib/supabase/server";

import { BANK_COLUMNS, bankExercise, type BankRow, rankBank } from "./staff";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The approved exercises of the bank that fit a question of the coach best
 * (RLS: a coach only reads approved exercises). An error gives none: the
 * staff still plans, with the coach's own library and its own proposals.
 */
export async function bankForStaff(supabase: Supabase, query: string): Promise<BankExercise[]> {
  const { data, error } = await supabase.from("bank_exercises").select(BANK_COLUMNS).eq("status", "approved").order("number").limit(500);
  if (error) {
    console.error("exercise bank could not be loaded", error);
    return [];
  }
  return rankBank((data ?? []) as BankRow[], query).map(bankExercise);
}
