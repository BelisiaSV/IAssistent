import type { Formation } from "@iassistent/staff-engine/content";

/** Lineup being edited: formation code, slot id -> player id, bench player ids. */
export interface LineupState {
  formation: string;
  starters: Record<string, string>;
  bench: string[];
}

function without(state: LineupState, playerId: string): LineupState {
  return {
    ...state,
    starters: Object.fromEntries(Object.entries(state.starters).filter(([, id]) => id !== playerId)),
    bench: state.bench.filter((id) => id !== playerId),
  };
}

/** Puts a player in a slot. The player leaves any other slot or the bench;
 *  the slot's previous player becomes unselected. */
export function assignToSlot(state: LineupState, slotId: string, playerId: string): LineupState {
  const next = without(state, playerId);
  return { ...next, starters: { ...next.starters, [slotId]: playerId } };
}

export function moveToBench(state: LineupState, playerId: string): LineupState {
  const next = without(state, playerId);
  return { ...next, bench: [...next.bench, playerId] };
}

export function removeFromLineup(state: LineupState, playerId: string): LineupState {
  return without(state, playerId);
}

export function clearSlot(state: LineupState, slotId: string): LineupState {
  const starters = { ...state.starters };
  delete starters[slotId];
  return { ...state, starters };
}

/**
 * Switches formation. Players keep a slot with the same id; players whose slot
 * disappears move to a free slot with the same position code, otherwise they
 * become unselected.
 */
export function changeFormation(state: LineupState, from: Formation | undefined, to: Formation): LineupState {
  const toIds = new Set(to.posten.map((s) => s.id));
  const starters: Record<string, string> = {};
  const displaced: { playerId: string; position: string | undefined }[] = [];

  for (const [slotId, playerId] of Object.entries(state.starters)) {
    if (toIds.has(slotId)) starters[slotId] = playerId;
    else displaced.push({ playerId, position: from?.posten.find((s) => s.id === slotId)?.positie });
  }
  for (const { playerId, position } of displaced) {
    const free = to.posten.find((s) => s.positie === position && !starters[s.id]);
    if (free) starters[free.id] = playerId;
  }
  return { formation: to.code, starters, bench: state.bench };
}
