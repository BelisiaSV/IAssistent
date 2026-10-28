import { describe, expect, it } from "vitest";

import { daysUntil, nextMatch, seasonResults } from "./dashboard";

const report = (match_date: string, goals_for: number | null, goals_against: number | null) => ({
  match_date,
  opponent_name: `Tegenstander ${match_date}`,
  home: true,
  goals_for,
  goals_against,
});

describe("team dashboard", () => {
  it("counts outcomes and running points from the start of the season", () => {
    const r = seasonResults(
      [report("2026-09-13", 1, 1), report("2026-08-30", 0, 2), report("2026-09-06", 3, 1), report("2026-08-10", 5, 0), report("2026-09-20", null, null)],
      "2026-08-30",
    );
    expect(r.matches.map((m) => [m.date, m.outcome, m.points])).toEqual([
      ["2026-08-30", "loss", 0],
      ["2026-09-06", "win", 3],
      ["2026-09-13", "draw", 4],
    ]);
    expect(r.counts).toEqual({ win: 1, draw: 1, loss: 1 });
    expect([r.points, r.goalsFor, r.goalsAgainst]).toEqual([4, 4, 4]);
    expect(seasonResults([report("2026-08-10", 5, 0)], null).matches).toHaveLength(1);
  });

  it("finds the next match from today in the week inputs", () => {
    const weeks = [
      { week_start: "2026-10-19", matches: [{ date: "2026-10-25", start: "15:00", opponent: "KFC Oud", home: true }] },
      { week_start: "2026-11-02", matches: [{ date: "2026-11-08", start: null, opponent: "SK Later", home: false }] },
      { week_start: "2026-10-26", matches: [{ date: "2026-11-01", start: "14:30", opponent: "VC Volgende", home: false }] },
      { week_start: "2026-11-09", matches: "kapot" },
    ];
    expect(nextMatch(weeks, "2026-10-28")).toEqual({
      date: "2026-11-01",
      start: "14:30",
      opponent: "VC Volgende",
      home: false,
      weekStart: "2026-10-26",
    });
    expect(nextMatch(weeks, "2026-11-09")).toBeNull();
    expect(daysUntil("2026-11-01", "2026-10-28")).toBe(4);
  });
});
