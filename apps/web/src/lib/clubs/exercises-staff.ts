import "server-only";

import type { BankExercise } from "@iassistent/staff-engine/content";

import {
  bankExercise,
  type BankRow,
  rankBank,
} from "@/lib/exercise-bank/staff";
import type { createClient } from "@/lib/supabase/server";

import { CLUB_EXERCISE_COLUMNS, type ClubExerciseRow } from "./exercises";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** At most this many club exercises go to the staff per question. */
export const CLUB_EXERCISES_FOR_STAFF = 15;

/** Recommended exercises first, then the best fit for the question. */
export function rankClubExercises(
  rows: ClubExerciseRow[],
  query: string,
  limit = CLUB_EXERCISES_FOR_STAFF,
): ClubExerciseRow[] {
  const ranked = rankBank(rows, query, rows.length) as ClubExerciseRow[];
  return [
    ...ranked.filter((r) => r.recommended),
    ...ranked.filter((r) => !r.recommended),
  ].slice(0, limit);
}

/**
 * What the staff of a club team gets from the club's exercise library: the
 * approved club exercises that fit the question (as CLUB-<n>, recommended
 * first) and the bank numbers the club recommends. Nothing for a personal
 * team or a club without the module.
 */
export async function clubExercisesForStaff(
  supabase: Supabase,
  team: { club_id: string | null },
  query: string,
): Promise<{ exercises: BankExercise[]; recommendedBank: string[] }> {
  const none = { exercises: [], recommendedBank: [] };
  if (!team.club_id) return none;
  const [{ data: active }, { data: rows }, { data: picks }] = await Promise.all(
    [
      supabase.rpc("club_has_module", {
        p_club_id: team.club_id,
        p_module: "exercises",
      }),
      supabase
        .from("club_exercises")
        .select(CLUB_EXERCISE_COLUMNS)
        .eq("club_id", team.club_id)
        .eq("status", "approved")
        .order("number")
        .limit(500),
      supabase
        .from("club_bank_picks")
        .select("bank_number")
        .eq("club_id", team.club_id)
        .eq("recommended", true),
    ],
  );
  if (active !== true) return none;
  return {
    exercises: rankClubExercises((rows ?? []) as ClubExerciseRow[], query).map(
      (r) => ({
        ...bankExercise(r as BankRow),
        ...(r.recommended ? { club_aanbevolen: true } : {}),
      }),
    ),
    recommendedBank: (picks ?? []).map((p) => p.bank_number),
  };
}
