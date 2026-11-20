import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { type ClubExerciseRow, clubExerciseFilters, clubLevels, filterClubExercises } from "./exercises";
import { rankClubExercises } from "./exercises-staff";

const row = (number: string, extra: Partial<ClubExerciseRow>): ClubExerciseRow => ({
  id: number,
  club_id: "c",
  number,
  title: number,
  kind: "Rondo",
  phase: "Balbezit",
  target_group: null,
  tags: [],
  principles: [],
  content: {},
  age_categories: [],
  level: null,
  origin: "club",
  base_bank_number: null,
  source_exercise_id: null,
  status: "approved",
  recommended: false,
  created_by: null,
  ...extra,
});

describe("club exercise filters", () => {
  const rows = [
    row("CLUB-1", { age_categories: ["u17"], level: "Provinciaal" }),
    row("CLUB-2", { age_categories: ["u15", "u17"], recommended: true, title: "Positiespel" }),
    row("CLUB-3", { age_categories: ["senioren"], level: "Elite", kind: "Partijvorm" }),
  ];

  it("filters on age category, level and recommended; recommended first", () => {
    expect(filterClubExercises(rows, clubExerciseFilters({ leeftijd: "u17" })).map((r) => r.number)).toEqual(["CLUB-2", "CLUB-1"]);
    expect(filterClubExercises(rows, clubExerciseFilters({ niveau: "Elite" })).map((r) => r.number)).toEqual(["CLUB-3"]);
    expect(filterClubExercises(rows, clubExerciseFilters({ aanbevolen: "1" })).map((r) => r.number)).toEqual(["CLUB-2"]);
    expect(filterClubExercises(rows, clubExerciseFilters({ type: "Partijvorm" })).map((r) => r.number)).toEqual(["CLUB-3"]);
    expect(filterClubExercises(rows, clubExerciseFilters({ q: "positiespel" })).map((r) => r.number)).toEqual(["CLUB-2"]);
  });

  it("lists the levels in use", () => {
    expect(clubLevels(rows)).toEqual(["Elite", "Provinciaal"]);
  });
});

describe("rankClubExercises", () => {
  it("puts recommended exercises first, then the best fit", () => {
    const rows = [
      row("CLUB-1", { title: "Opbouw van achteruit" }),
      row("CLUB-2", { title: "Afwerking", recommended: true }),
      row("CLUB-3", { title: "Opbouw onder druk" }),
    ];
    expect(rankClubExercises(rows, "opbouw", 2).map((r) => r.number)).toEqual(["CLUB-2", "CLUB-1"]);
  });
});
