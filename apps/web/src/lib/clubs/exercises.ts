import {
  type BankFilters,
  bankFilters,
  filterBank,
} from "@/lib/exercise-bank/filters";
import type { BankRow } from "@/lib/exercise-bank/staff";

/** Columns of a club exercise the pages and the staff need. */
export const CLUB_EXERCISE_COLUMNS =
  "id, club_id, number, title, kind, phase, target_group, tags, principles, content, age_categories, level, origin, base_bank_number, source_exercise_id, status, recommended, created_by, created_at";

/** A club exercise: the shape of a bank exercise plus the club's own fields. */
export interface ClubExerciseRow extends BankRow {
  id: string;
  club_id: string;
  age_categories: string[];
  level: string | null;
  origin: string;
  base_bank_number: string | null;
  source_exercise_id: string | null;
  status: string;
  recommended: boolean;
  created_by: string | null;
}

export interface ClubExerciseFilters extends BankFilters {
  leeftijd: string;
  niveau: string;
  aanbevolen: string;
}

export function clubExerciseFilters(
  params: Partial<Record<string, string | string[] | undefined>>,
): ClubExerciseFilters {
  const value = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return {
    ...bankFilters(params),
    leeftijd: value("leeftijd"),
    niveau: value("niveau"),
    aanbevolen: value("aanbevolen"),
  };
}

/** The levels to choose from, from the exercises themselves. */
export function clubLevels(rows: ClubExerciseRow[]): string[] {
  return [...new Set(rows.map((r) => r.level ?? "").filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "nl"),
  );
}

/**
 * The club exercises that pass every filter: the bank's filters (search,
 * phase, type, load, principle, zone) plus age category, level and
 * "recommended only". Recommended exercises come first.
 */
export function filterClubExercises(
  rows: ClubExerciseRow[],
  f: ClubExerciseFilters,
): ClubExerciseRow[] {
  const byNumber = new Map(rows.map((r) => [r.number, r]));
  return (filterBank(rows, f) as BankRow[])
    .map((r) => byNumber.get(r.number)!)
    .filter(
      (r) =>
        (!f.leeftijd || r.age_categories.includes(f.leeftijd)) &&
        (!f.niveau || r.level === f.niveau) &&
        (!f.aanbevolen || r.recommended),
    )
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
}
