import type { MatchDayCatalog } from "@iassistent/staff-engine/content";
import { describe, expect, it } from "vitest";

import { dayPlans } from "./microcycle";

const catalog = {
  versie: "1",
  uitleg: "",
  dagen: [
    { code: "MD", naam: "Wedstrijddag", uitleg: "", dagen_tot_wedstrijd: 0 },
    { code: "MD+1", naam: "Herstel", uitleg: "", dagen_na_wedstrijd: 1 },
    { code: "MD-1", naam: "Activatie", uitleg: "", dagen_tot_wedstrijd: 1 },
  ],
} as unknown as MatchDayCatalog;

describe("day plans", () => {
  it("labels the days around the matches of all weeks and finds the training or match of each day", () => {
    const weeks = [
      {
        week_start: "2026-10-26",
        trainings: [{ date: "2026-10-31", start: "19:30", duration_min: 75 }],
        matches: [{ date: "2026-11-01", start: "14:30", opponent: "VC Westerlo", home: false }],
        previous_match_date: "2026-10-25",
      },
      { week_start: "2026-11-02", trainings: "kapot", matches: [], previous_match_date: null },
    ];
    const days = dayPlans(["2026-10-26", "2026-10-28", "2026-10-31", "2026-11-01", "2026-11-02"], weeks, catalog);
    expect(days.map((d) => d.md?.code ?? null)).toEqual(["MD+1", null, "MD-1", "MD", "MD+1"]);
    expect(days[2]!.training).toEqual({ start: "19:30", minutes: 75 });
    expect(days[3]!.match).toEqual({ opponent: "VC Westerlo", home: false, start: "14:30" });
    expect(days[4]!.training).toBeNull();
  });
});
