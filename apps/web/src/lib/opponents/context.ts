import type { Tables } from "@iassistent/db";
import type { MatchEvaluation, OpponentContext } from "@iassistent/staff-engine/content";

import { opponentLineupSchema } from "./validation";

type Opponent = Pick<
  Tables<"opponents">,
  "name" | "play_style" | "strengths" | "weaknesses" | "set_pieces" | "notes"
>;
type OpponentLineup = Pick<Tables<"opponent_lineups">, "source" | "match_date" | "formation" | "starters" | "bench">;
type MatchReport = Pick<
  Tables<"match_reports">,
  | "match_date"
  | "opponent_name"
  | "home"
  | "goals_for"
  | "goals_against"
  | "own_formation"
  | "opponent_formation"
  | "went_well"
  | "went_badly"
  | "lessons"
>;

/** Normalised opponent name, as in the unique index on opponents. */
export const opponentKey = (name: string) => name.trim().toLowerCase();

/**
 * The next opponent for the staff: fiche and last known lineup, shirt numbers
 * only (names never leave the app).
 */
export function opponentContext(input: {
  name: string;
  home: boolean | null;
  opponent: Opponent | null;
  lineup: OpponentLineup | null;
}): OpponentContext {
  const lineup = input.lineup ? opponentLineupSchema.safeParse(input.lineup) : null;
  const parsed = lineup?.success ? lineup.data : null;
  return {
    naam: input.opponent?.name ?? input.name,
    thuis: input.home,
    formatie: parsed?.formation ?? null,
    speelstijl: input.opponent?.play_style ?? null,
    sterktes: input.opponent?.strengths ?? null,
    zwaktes: input.opponent?.weaknesses ?? null,
    standaardsituaties: input.opponent?.set_pieces ?? null,
    notities: input.opponent?.notes ?? null,
    opstelling: parsed
      ? {
          bron: input.lineup!.source,
          datum: input.lineup!.match_date,
          formatie: parsed.formation,
          basis: Object.entries(parsed.starters).map(([post, p]) => ({ post, rugnummer: p.number })),
          bank: parsed.bench.map((p) => p.number),
        }
      : null,
  };
}

/** Findings of the head coach, newest first, flagged when the opponent then
 *  played the same formation as the next opponent. */
export function matchEvaluations(reports: MatchReport[], nextFormation: string | null): MatchEvaluation[] {
  return [...reports]
    .sort((a, b) => b.match_date.localeCompare(a.match_date))
    .map((r) => ({
      datum: r.match_date,
      tegenstander: r.opponent_name,
      thuis: r.home,
      uitslag: r.goals_for !== null && r.goals_against !== null ? `${r.goals_for}-${r.goals_against}` : null,
      eigen_formatie: r.own_formation,
      formatie_tegenstander: r.opponent_formation,
      zelfde_formatie_als_tegenstander: !!nextFormation && r.opponent_formation === nextFormation,
      wat_ging_goed: r.went_well,
      wat_ging_slecht: r.went_badly,
      lessen: r.lessons,
    }));
}

/** Shirt number -> name from an opponent lineup (only shown in the app). */
export function opponentNames(lineup: Pick<OpponentLineup, "formation" | "starters" | "bench"> | null): Map<number, string> {
  const parsed = lineup ? opponentLineupSchema.safeParse(lineup) : null;
  if (!parsed?.success) return new Map();
  return new Map(
    [...Object.values(parsed.data.starters), ...parsed.data.bench]
      .filter((p) => p.number !== null && p.name !== "")
      .map((p) => [p.number!, p.name]),
  );
}
