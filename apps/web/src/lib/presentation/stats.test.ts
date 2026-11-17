import { describe, expect, it } from "vitest";

import { opponentStats, sameTeam, teamSeason } from "./stats";

const m = (
  match_date: string,
  home: string,
  away: string,
  hg: number | null,
  ag: number | null,
) => ({
  division: "1",
  match_date,
  kickoff: null,
  home,
  away,
  home_goals: hg,
  away_goals: ag,
  status: null,
  matchday: null,
  referee: null,
  assistant_1: null,
  assistant_2: null,
});
const all = [
  m("2026-10-04", "X", "A", 0, 1),
  m("2026-10-11", "A", "B", 2, 2),
  m("2026-10-18", "C", "A", 1, 1),
  m("2026-10-25", "A", "D", 0, 0),
  m("2026-11-01", "E", "A", 3, 1),
  m("2026-11-08", "A", "F", 2, 0),
  m("2026-11-22", "A", "G", null, null),
];

describe("presentation statistics", () => {
  it("gives the last five results before the match, oldest first", () => {
    const s = opponentStats(all, "A", 4, "2026-11-22");
    expect(s.last.map((r) => `${r.outcome[0]}${r.opponent}`)).toEqual([
      "dB",
      "dC",
      "dD",
      "lE",
      "wF",
    ]);
    expect(s).toMatchObject({
      position: 4,
      record: { win: 1, draw: 3, loss: 1 },
      points: 6,
      matches: 5,
    });
  });
  it("counts fewer matches early in the season", () => {
    expect(opponentStats(all, "A", null, "2026-10-12")).toMatchObject({
      matches: 2,
      points: 4,
    });
  });
  it("matches names loosely", () => {
    expect(sameTeam(" KFC Merelbeke", "kfc merelbeke ")).toBe(true);
  });
});

describe("teamSeason", () => {
  it("adds up the points of every played match", () => {
    const all = [m("2026-09-06", "A", "B", 2, 1), m("2026-09-13", "C", "A", 1, 1), m("2026-09-20", "A", "D", 0, 3), m("2026-09-27", "A", "E", null, null)];
    expect(teamSeason(all, "A").map((x) => [x.opponent, x.home, x.goalsFor, x.goalsAgainst, x.outcome, x.points])).toEqual([
      ["B", true, 2, 1, "win", 3],
      ["C", false, 1, 1, "draw", 4],
      ["D", true, 0, 3, "loss", 4],
    ]);
    expect(teamSeason(all, "A", "2026-09-20")).toHaveLength(2);
  });
});
