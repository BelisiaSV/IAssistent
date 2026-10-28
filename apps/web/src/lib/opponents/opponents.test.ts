import { describe, expect, it } from "vitest";

import { lineupFromMatchPlan } from "@/lib/proposals/lineup";

import { matchEvaluations, opponentContext, opponentKey, opponentNames } from "./context";
import { compactLineup, matchReportSchema, opponentFicheSchema, opponentLineupSchema } from "./validation";

const lineup = {
  source: "coach" as const,
  match_date: "2026-10-11",
  formation: "4-4-2",
  starters: { GK: { number: 1, name: "Peeters" }, ST1: { number: 9, name: "Janssens" } },
  bench: [{ number: 12, name: "Wouters" }],
};

describe("opponent context", () => {
  it("keeps shirt numbers and drops all names", () => {
    const context = opponentContext({
      name: "kfc voorbeeld",
      home: true,
      opponent: { name: "KFC Voorbeeld", play_style: "Direct", strengths: null, weaknesses: null, set_pieces: null, notes: null },
      lineup,
    });
    expect(context).toMatchObject({
      naam: "KFC Voorbeeld",
      thuis: true,
      formatie: "4-4-2",
      speelstijl: "Direct",
      opstelling: { bron: "coach", basis: [{ post: "GK", rugnummer: 1 }, { post: "ST1", rugnummer: 9 }], bank: [12] },
    });
    expect(JSON.stringify(context)).not.toMatch(/Peeters|Janssens|Wouters/);
  });

  it("works without fiche or lineup", () => {
    expect(opponentContext({ name: "X", home: false, opponent: null, lineup: null })).toMatchObject({
      naam: "X",
      formatie: null,
      opstelling: null,
    });
  });

  it("maps opponent shirt numbers to names for the app only", () => {
    expect(opponentNames(lineup).get(9)).toBe("Janssens");
    expect(opponentNames(null).size).toBe(0);
  });

  it("matches names case- and space-insensitively", () => {
    expect(opponentKey("  KFC Voorbeeld ")).toBe(opponentKey("kfc voorbeeld"));
  });
});

describe("match evaluations", () => {
  it("sorts newest first and flags the same formation as the next opponent", () => {
    const base = {
      opponent_name: "A",
      home: true,
      goals_for: 2,
      goals_against: 1,
      own_formation: "4-3-3",
      went_well: "Druk",
      went_badly: null,
      lessons: null,
    };
    const result = matchEvaluations(
      [
        { ...base, match_date: "2026-10-04", opponent_formation: "4-4-2" },
        { ...base, match_date: "2026-10-11", opponent_formation: "3-5-2", goals_for: null },
      ],
      "4-4-2",
    );
    expect(result.map((r) => r.datum)).toEqual(["2026-10-11", "2026-10-04"]);
    expect(result[0]).toMatchObject({ uitslag: null, zelfde_formatie_als_tegenstander: false });
    expect(result[1]).toMatchObject({ uitslag: "2-1", zelfde_formatie_als_tegenstander: true });
  });
});

describe("validation", () => {
  it("validates the fiche", () => {
    expect(opponentFicheSchema.safeParse({ name: " ", playStyle: "", strengths: "", weaknesses: "", setPieces: "", notes: "", coachName: "", address: "" }).success).toBe(false);
    expect(
      opponentFicheSchema.parse({ name: "KFC", playStyle: "", strengths: "x", weaknesses: "", setPieces: "", notes: "", coachName: " Piet ", address: "" }),
    ).toMatchObject({ name: "KFC", playStyle: null, strengths: "x", coachName: "Piet", address: null });
  });

  it("validates and compacts an opponent lineup", () => {
    expect(opponentLineupSchema.safeParse({ formation: "4-4-2", starters: { GK: { number: 100, name: "" } }, bench: [] }).success).toBe(false);
    const parsed = opponentLineupSchema.parse({
      formation: "4-4-2",
      starters: { GK: { number: 1, name: "" }, LB: { number: null, name: "" }, XX: { number: 5, name: "" } },
      bench: [{ number: null, name: "" }, { number: 14, name: "Bank" }],
    });
    expect(compactLineup(parsed, new Set(["GK", "LB"]))).toEqual({
      formation: "4-4-2",
      starters: { GK: { number: 1, name: "" } },
      bench: [{ number: 14, name: "Bank" }],
    });
  });

  it("validates a match report", () => {
    expect(matchReportSchema.parse({ goalsFor: "2", goalsAgainst: "", ownFormation: "", opponentFormation: "4-4-2", wentWell: " ", wentBadly: "", lessons: "" })).toEqual({
      goalsFor: 2,
      goalsAgainst: null,
      ownFormation: null,
      opponentFormation: "4-4-2",
      wentWell: null,
      wentBadly: null,
      lessons: null,
    });
    expect(matchReportSchema.safeParse({ goalsFor: "60", goalsAgainst: "", ownFormation: "", opponentFormation: "", wentWell: "", wentBadly: "", lessons: "" }).success).toBe(false);
  });
});

describe("lineup from match plan", () => {
  it("maps shirt numbers to players and skips unknown or duplicate numbers", () => {
    const players = [
      { id: "a", shirt_number: 1, archived_at: null },
      { id: "b", shirt_number: 9, archived_at: null },
      { id: "c", shirt_number: 12, archived_at: null },
      { id: "d", shirt_number: 7, archived_at: "2026-01-01" },
    ];
    const result = lineupFromMatchPlan(
      {
        formatie: "4-3-3",
        basis: [
          { post: "GK", rugnummer: 1, taak: "" },
          { post: "ST", rugnummer: 9, taak: "" },
          { post: "RW", rugnummer: 7, taak: "" },
          { post: "NOPE", rugnummer: 12, taak: "" },
        ],
        bank: [9, 12, 99],
        toelichting: "",
      },
      players,
      new Set(["GK", "ST", "RW"]),
    );
    expect(result).toEqual({ starters: { GK: "a", ST: "b" }, bench: ["c"] });
  });
});
