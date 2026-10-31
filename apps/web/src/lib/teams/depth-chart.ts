import type { FormationSlot, PositionCatalog } from "@iassistent/staff-engine/content";

export interface DepthPlayer {
  id: string;
  primaryPosition: string | null;
  secondaryPositions: string[];
}

export interface DepthChart<P extends DepthPlayer> {
  /** Players per slot id, in the order given. */
  slots: Map<string, P[]>;
  /** Players without a position, or whose positions fit no slot of the formation. */
  unplaced: P[];
}

/**
 * Puts every player on a slot of the formation: first a slot of his main
 * position, then one of his other positions, then a slot in the same line.
 * Slots of the same position (two CB's) share the players evenly.
 */
export function depthChart<P extends DepthPlayer>(players: readonly P[], slots: readonly FormationSlot[], positions: PositionCatalog): DepthChart<P> {
  const lineOf = new Map(positions.posities.map((p) => [p.code, p.linie]));
  const bySlot = new Map<string, P[]>(slots.map((s) => [s.id, []]));
  const unplaced: P[] = [];

  for (const player of players) {
    const primary = player.primaryPosition;
    const candidates = [
      slots.filter((s) => s.positie === primary),
      slots.filter((s) => player.secondaryPositions.includes(s.positie)),
      primary && lineOf.has(primary) ? slots.filter((s) => lineOf.get(s.positie) === lineOf.get(primary)) : [],
    ].find((list) => list.length > 0);
    if (!primary || !candidates) {
      unplaced.push(player);
      continue;
    }
    const slot = candidates.reduce((best, s) => (bySlot.get(s.id)!.length < bySlot.get(best.id)!.length ? s : best));
    bySlot.get(slot.id)!.push(player);
  }
  return { slots: bySlot, unplaced };
}
