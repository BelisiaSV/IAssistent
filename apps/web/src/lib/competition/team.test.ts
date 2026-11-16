import { describe, expect, it } from "vitest";

import { formOf, matchesOf, nextMatchOf, opponentOf } from "./team";

const m = (match_date: string, home: string, away: string, hg: number | null = null, ag: number | null = null, status: string | null = null) => ({
  division: "1", match_date, kickoff: "15:00", home, away, home_goals: hg, away_goals: ag, status, matchday: null, referee: null, assistant_1: null, assistant_2: null,
});
const all = [m("2026-11-08", "A", "B", 2, 1), m("2026-11-01", "C", "A", 3, 0), m("2026-11-15", "A", "D", 1, 1), m("2026-11-22", "E", "A", null, null, "PP"), m("2026-11-29", "A", "F"), m("2026-11-08", "C", "D", 0, 0)];

describe("competition of a team", () => {
  it("lists the matches of a team in date order", () => {
    expect(matchesOf(all, "A").map((x) => x.match_date)).toEqual(["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
  });
  it("gives the form, most recent first", () => {
    expect(formOf(all, "A")).toEqual(["draw", "win", "loss"]);
  });
  it("finds the next match that is not postponed, and the opponent", () => {
    const next = nextMatchOf(all, "A", "2026-11-16")!;
    expect(next.match_date).toBe("2026-11-29");
    expect(opponentOf(next, "A")).toBe("F");
  });
});
