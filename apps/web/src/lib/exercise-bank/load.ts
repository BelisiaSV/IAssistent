import "server-only";

import { BANK_MEDIA_BUCKET } from "@iassistent/db";
import type { BankExercise } from "@iassistent/staff-engine/content";

import type { createClient } from "@/lib/supabase/server";

import { BANK_COLUMNS, bankExercise, type BankRow, rankBank } from "./staff";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The approved exercises of the bank that fit a question of the coach best
 * (RLS: a coach only reads approved exercises). An error gives none: the
 * staff still plans, with the coach's own library and its own proposals.
 */
export async function bankForStaff(supabase: Supabase, query: string, clubRecommended: string[] = []): Promise<BankExercise[]> {
  const { data, error } = await supabase.from("bank_exercises").select(BANK_COLUMNS).eq("status", "approved").order("number").limit(500);
  if (error) {
    console.error("exercise bank could not be loaded", error);
    return [];
  }
  const rows = (data ?? []) as BankRow[];
  // Exercises the team's club recommends come first and are marked.
  const recommended = new Set(clubRecommended);
  const picked = rows.filter((r) => recommended.has(r.number));
  const rest = rankBank(
    rows.filter((r) => !recommended.has(r.number)),
    query,
  );
  // At most ten recommended exercises, then the best fit (rankBank keeps its own limit).
  return [...picked.slice(0, 10).map((r) => ({ ...bankExercise(r), club_aanbevolen: true })), ...rest.map(bankExercise)];
}

/** Signed URLs (an hour) for files of the bank, by path. */
export async function bankMediaUrls(supabase: Supabase, paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!wanted.length) return urls;
  const { data } = await supabase.storage.from(BANK_MEDIA_BUCKET).createSignedUrls(wanted, 3600);
  for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}
