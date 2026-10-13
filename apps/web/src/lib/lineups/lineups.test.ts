import type { Formation } from "@iassistent/staff-engine/content";
import { describe, expect, it } from "vitest";

import { assignToSlot, changeFormation, moveToBench, type LineupState } from "./state";
import { parseLineupPlayers } from "./validation";

const f442: Formation = {
  code: "4-4-2",
  naam: "4-4-2",
  posten: [
    { id: "GK", positie: "GK", x: 50, y: 90 },
    { id: "LST", positie: "ST", x: 40, y: 15 },
    { id: "RST", positie: "ST", x: 60, y: 15 },
  ],
};
const f433: Formation = {
  code: "4-3-3",
  naam: "4-3-3",
  posten: [
    { id: "GK", positie: "GK", x: 50, y: 90 },
    { id: "ST", positie: "ST", x: 50, y: 15 },
    { id: "LW", positie: "LW", x: 15, y: 20 },
  ],
};

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";

describe("lineup state", () => {
  const empty: LineupState = { formation: "4-4-2", starters: {}, bench: [] };

  it("moves a player between slots and bench without duplicates", () => {
    let s = assignToSlot(empty, "GK", P1);
    s = moveToBench(s, P1);
    expect(s).toEqual({ formation: "4-4-2", starters: {}, bench: [P1] });
    s = assignToSlot(s, "LST", P1);
    expect(s).toEqual({ formation: "4-4-2", starters: { LST: P1 }, bench: [] });
  });

  it("replaces the player in an occupied slot", () => {
    const s = assignToSlot(assignToSlot(empty, "GK", P1), "GK", P2);
    expect(s.starters).toEqual({ GK: P2 });
  });

  it("keeps players when switching formation where possible", () => {
    const s: LineupState = { formation: "4-4-2", starters: { GK: P1, LST: P2, RST: P3 }, bench: [] };
    const next = changeFormation(s, f442, f433);
    expect(next.formation).toBe("4-3-3");
    expect(next.starters).toEqual({ GK: P1, ST: P2 }); // P3 has no free ST slot
  });
});

describe("parseLineupPlayers", () => {
  const squad = new Set([P1, P2, P3]);

  it("accepts a valid lineup", () => {
    expect(parseLineupPlayers({ starters: { GK: P1 }, bench: [P2] }, f442, squad)).toEqual({
      starters: { GK: P1 },
      bench: [P2],
    });
  });

  it("rejects unknown slots, duplicates and players outside the squad", () => {
    expect(parseLineupPlayers({ starters: { XX: P1 }, bench: [] }, f442, squad)).toBeNull();
    expect(parseLineupPlayers({ starters: { GK: P1 }, bench: [P1] }, f442, squad)).toBeNull();
    expect(
      parseLineupPlayers(
        { starters: { GK: "44444444-4444-4444-8444-444444444444" }, bench: [] },
        f442,
        squad,
      ),
    ).toBeNull();
  });
});
