import type { Outcome } from "@/lib/teams/dashboard";

export interface CompetitionMatch {
  division: string;
  match_date: string;
  kickoff: string | null;
  home: string;
  away: string;
  home_goals: number | null;
  away_goals: number | null;
  status: string | null;
  matchday: number | null;
  referee: string | null;
  assistant_1: string | null;
  assistant_2: string | null;
}

/** The matches of a team, in date order. */
export function matchesOf<T extends CompetitionMatch>(matches: readonly T[], team: string): T[] {
  return matches.filter((m) => m.home === team || m.away === team).toSorted((a, b) => a.match_date.localeCompare(b.match_date) || (a.kickoff ?? "").localeCompare(b.kickoff ?? ""));
}

/** Win, draw or loss for a team in a played match, else null. */
export function outcomeFor(match: CompetitionMatch, team: string): Outcome | null {
  if (match.home_goals === null || match.away_goals === null) return null;
  const own = match.home === team ? match.home_goals : match.away_goals;
  const other = match.home === team ? match.away_goals : match.home_goals;
  return own > other ? "win" : own === other ? "draw" : "loss";
}

/** The last `n` results of a team, most recent first. */
export function formOf(matches: readonly CompetitionMatch[], team: string, n = 5): Outcome[] {
  return matchesOf(matches, team)
    .flatMap((m) => {
      const o = outcomeFor(m, team);
      return o ? [o] : [];
    })
    .reverse()
    .slice(0, n);
}

/** The next match of a team from today (not postponed). */
export function nextMatchOf<T extends CompetitionMatch>(matches: readonly T[], team: string, today: string): T | null {
  return matchesOf(matches, team).find((m) => m.match_date >= today && m.home_goals === null && m.status !== "PP") ?? null;
}

export const opponentOf = (match: { home: string; away: string }, team: string) => (match.home === team ? match.away : match.home);
