import { matchDayFor, type MatchDayCatalog } from "@iassistent/staff-engine/content";
import { z } from "zod";

import { weekMatchSchema, weekTrainingSchema } from "@/lib/weeks/validation";

export interface DayPlan {
  date: string;
  /** Match-day label (MD-1, MD, …) with its name, null when far from a match. */
  md: { code: string; naam: string } | null;
  training: { start: string; minutes: number } | null;
  match: { opponent: string; home: boolean; start: string | null } | null;
}

interface WeekRow {
  week_start: string;
  trainings: unknown;
  matches: unknown;
  previous_match_date: string | null;
}

const trainings = z.array(weekTrainingSchema);
const matches = z.array(weekMatchSchema);

/** What happens on each date according to the week inputs: label, training and match. */
export function dayPlans(dates: readonly string[], weeks: readonly WeekRow[], catalog: MatchDayCatalog): DayPlan[] {
  const allTrainings = weeks.flatMap((w) => trainings.safeParse(w.trainings).data ?? []);
  const allMatches = weeks.flatMap((w) => matches.safeParse(w.matches).data ?? []);
  const matchDates = [...new Set([...weeks.flatMap((w) => (w.previous_match_date ? [w.previous_match_date] : [])), ...allMatches.map((m) => m.date)])].sort();

  return dates.map((date) => {
    const md = matchDayFor(date, matchDates, catalog);
    const training = allTrainings.find((t) => t.date === date);
    const match = allMatches.find((m) => m.date === date);
    return {
      date,
      md: md ? { code: md.code, naam: md.naam } : null,
      training: training ? { start: training.start, minutes: training.duration_min } : null,
      match: match ? { opponent: match.opponent, home: match.home, start: match.start } : null,
    };
  });
}
