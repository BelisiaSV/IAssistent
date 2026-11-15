/** Age categories of a team, as stored in teams.age_category (labels in messages). */
export const AGE_CATEGORIES = ["u15", "u16", "u17", "u19", "beloften", "b-elftal", "senioren"] as const;
export type AgeCategory = (typeof AGE_CATEGORIES)[number];

/** Youth teams: they work with the club's monthly development goals and with evaluations. */
export const YOUTH_CATEGORIES: readonly AgeCategory[] = ["u15", "u16", "u17", "u19"];

export function ageCategory(value: string | null | undefined): AgeCategory {
  return AGE_CATEGORIES.find((c) => c === value) ?? "senioren";
}
