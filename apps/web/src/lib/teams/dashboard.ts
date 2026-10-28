import { z } from "zod";

import { weekMatchSchema } from "@/lib/weeks/validation";

export type Outcome = "win" | "draw" | "loss";

/** Status colours of a result; always shown together with the letter (W/G/V). */
export const OUTCOME_COLORS: Record<Outcome, string> = { win: "#15803d", draw: "#64748b", loss: "#b91c1c" };

/** Points per outcome, as in the Belgian leagues. */
const POINTS: Record<Outcome, number> = { win: 3, draw: 1, loss: 0 };

export interface PlayedMatch {
  date: string;
  opponent: string;
  home: boolean | null;
  goalsFor: number;
  goalsAgainst: number;
  outcome: Outcome;
  /** Points after this match (cumulative over the season). */
  points: number;
}

export interface SeasonResults {
  matches: PlayedMatch[];
  counts: Record<Outcome, number>;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
}

interface ReportRow {
  match_date: string;
  opponent_name: string;
  home: boolean | null;
  goals_for: number | null;
  goals_against: number | null;
}

/** Matches with a score from `since` on (null = all), oldest first, with the running points. */
export function seasonResults(reports: readonly ReportRow[], since: string | null): SeasonResults {
  const counts: Record<Outcome, number> = { win: 0, draw: 0, loss: 0 };
  let points = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const matches = reports
    .filter((r) => r.goals_for !== null && r.goals_against !== null && (!since || r.match_date >= since))
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .map((r): PlayedMatch => {
      const gf = r.goals_for!;
      const ga = r.goals_against!;
      const outcome: Outcome = gf > ga ? "win" : gf === ga ? "draw" : "loss";
      counts[outcome] += 1;
      points += POINTS[outcome];
      goalsFor += gf;
      goalsAgainst += ga;
      return { date: r.match_date, opponent: r.opponent_name, home: r.home, goalsFor: gf, goalsAgainst: ga, outcome, points };
    });
  return { matches, counts, points, goalsFor, goalsAgainst };
}

export interface NextMatch {
  date: string;
  start: string | null;
  opponent: string;
  home: boolean;
  /** Monday of the week the match is in (link to the week). */
  weekStart: string;
}

const matchesSchema = z.array(weekMatchSchema);

/** The first match from today on in the week inputs. */
export function nextMatch(weeks: readonly { week_start: string; matches: unknown }[], today: string): NextMatch | null {
  const upcoming = weeks.flatMap((w) => {
    const parsed = matchesSchema.safeParse(w.matches);
    return parsed.success ? parsed.data.filter((m) => m.date >= today).map((m) => ({ ...m, weekStart: w.week_start })) : [];
  });
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
  const first = upcoming[0];
  return first ? { date: first.date, start: first.start, opponent: first.opponent, home: first.home, weekStart: first.weekStart } : null;
}

/** Whole days from today until the date (0 = today). */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
