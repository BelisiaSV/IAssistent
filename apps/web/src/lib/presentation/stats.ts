import { type CompetitionMatch, matchesOf, opponentOf, outcomeFor } from "@/lib/competition/team";
import type { Outcome } from "@/lib/teams/dashboard";

const POINTS: Record<Outcome, number> = { win: 3, draw: 1, loss: 0 };

/** Form of a team for slide 2: its last (up to) five played matches, oldest first. */
export interface OpponentStats {
  /** [XPS] position in the standings */
  position: number | null;
  /** [XR] wins, draws and losses in these matches */
  record: { win: number; draw: number; loss: number };
  /** [XP] points from these matches */
  points: number;
  /** [XM] number of matches (at most five) */
  matches: number;
  /** Results and opponents, oldest first ([Logo tegenstander -5] … [-1]). */
  last: { outcome: Outcome; opponent: string; date: string }[];
}

/** The last five results of a team before `before` (a date), with its position. */
export function opponentStats(
  all: readonly CompetitionMatch[],
  team: string,
  position: number | null,
  before: string,
  count = 5,
): OpponentStats {
  const last = matchesOf(all, team)
    .filter((m) => m.match_date < before)
    .flatMap((m) => {
      const outcome = outcomeFor(m, team);
      return outcome ? [{ outcome, opponent: opponentOf(m, team), date: m.match_date }] : [];
    })
    .slice(-count);
  const record = { win: 0, draw: 0, loss: 0 };
  for (const r of last) record[r.outcome] += 1;
  return { position, record, points: last.reduce((sum, r) => sum + POINTS[r.outcome], 0), matches: last.length, last };
}

/** The name of a team as in the competition, matched loosely (case, spaces). */
export function sameTeam(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
