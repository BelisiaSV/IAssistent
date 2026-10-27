import { describe, expect, it } from "vitest";

import { readableOn, weekOverview } from "./overview";
import type { WeekPlanningOutput, WeekPlanningPart } from "./types";

const part = (fase: WeekPlanningPart["fase"], naam: string): WeekPlanningPart => ({
  fase,
  naam,
  doel: "",
  organisatie: "",
  spelers: "",
  coachingspunten: [],
  duur_min: 10,
  reeksen: null,
  werk_per_reeks: null,
  rust_tussen_reeksen: null,
  intensiteit: "matig",
  rpe: null,
});

const ac: WeekPlanningOutput = {
  weekfocus: "",
  individueel: [],
  aandachtspunten: [],
  vragen_aan_coach: [],
  dagen: [
    { datum: "2026-10-20", md: "MD-5", soort: "training", titel: "Intensief", doel: "", tijdstip: "20:00", totale_duur_min: 90, belasting: "hoog", opmerking: null,
      onderdelen: [part("opwarming", "Rondo"), part("kern", "9v9 pressing"), part("kern", "Afwerken"), part("afsluiting", "Uitlopen")] },
    { datum: "2026-10-21", md: "MD-4", soort: "rust", titel: "Rust", doel: "", tijdstip: null, totale_duur_min: null, belasting: "rust", opmerking: null, onderdelen: [] },
    { datum: "2026-10-25", md: "MD", soort: "wedstrijd", titel: "Wedstrijd", doel: "", tijdstip: "15:00", totale_duur_min: 90, belasting: "zeer hoog", opmerking: null, onderdelen: [] },
  ],
};

describe("week overview", () => {
  it("shows per day the goal, kern content, focus, time and intensity", () => {
    const tc = {
      speelplan: { kernboodschap: "Samen druk zetten." } as never,
      trainingsaccenten: [{ datum: "2026-10-20", md: "MD-5", thema: "Pressing", doel: "", aandachtspunten: [] }],
    };
    const o = weekOverview(ac, tc, [{ date: "2026-10-25", start: "14:30", opponent: "KFC Voorbeeld", home: false }]);
    expect(o.keyMessage).toBe("Samen druk zetten.");
    expect(o.days[0]).toMatchObject({ objective: "Intensief", content: ["9v9 pressing", "Afwerken"], focus: "Pressing", start: "20:00", durationMin: 90, intensity: 4 });
    expect(o.days[1]).toMatchObject({ intensity: 0, content: [], focus: null });
    expect(o.days[2]).toMatchObject({ intensity: 5, start: "14:30", durationMin: null, match: { opponent: "KFC Voorbeeld", home: false } });
  });

  it("works without a tactical plan", () => {
    expect(weekOverview(ac, null, []).keyMessage).toBeNull();
  });

  it("picks readable text on team colours", () => {
    expect(readableOn("#0B3D91")).toBe("#ffffff");
    expect(readableOn("#F2C200")).toBe("#0f172a");
    expect(readableOn("oops")).toBe("#ffffff");
  });
});
