import type { ClubPeriodContext } from "@iassistent/staff-engine/content";

export interface PeriodRow {
  title: string;
  starts_on: string;
  ends_on: string;
  age_categories: string[];
  goals: string[];
  focus: string | null;
}

/** The current period for an age category: one for that category first, then one for every category. */
export function periodFor(
  periods: readonly PeriodRow[],
  category: string,
): ClubPeriodContext | null {
  const p = periods.find((x) => x.age_categories.includes(category)) ?? periods.find((x) => x.age_categories.length === 0);
  return p ? { titel: p.title, van: p.starts_on, tot: p.ends_on, trainingsdoelen: p.goals, focus: p.focus } : null;
}

/** Periods that touch [from, to], in order. */
export function periodsBetween<T extends PeriodRow>(periods: readonly T[], from: string, to: string): T[] {
  return periods.filter((p) => p.starts_on <= to && p.ends_on >= from).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}
