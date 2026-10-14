import type { MatchPrepOutput } from "./types";

/**
 * Turns the lineup of a Tactical Coach match plan (shirt numbers) into a lineup
 * of the team (player ids). Unknown shirt numbers are skipped.
 */
export function lineupFromMatchPlan(
  lineup: MatchPrepOutput["opstelling"],
  players: { id: string; shirt_number: number | null; archived_at: string | null }[],
  slotIds: ReadonlySet<string>,
): { starters: Record<string, string>; bench: string[] } {
  const byNumber = new Map(
    players.filter((p) => !p.archived_at && p.shirt_number !== null).map((p) => [p.shirt_number!, p.id]),
  );
  const used = new Set<string>();
  const take = (number: number) => {
    const id = byNumber.get(number);
    if (!id || used.has(id)) return null;
    used.add(id);
    return id;
  };
  const starters: Record<string, string> = {};
  for (const b of lineup.basis) {
    if (!slotIds.has(b.post) || starters[b.post]) continue;
    const id = take(b.rugnummer);
    if (id) starters[b.post] = id;
  }
  const bench = lineup.bank.flatMap((nr) => take(nr) ?? []);
  return { starters, bench };
}
