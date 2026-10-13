import { describe, expect, it } from "vitest";

import { shirtNames, withShirtNames } from "./names";
import { weekPlanningToText } from "./text";
import type { WeekPlanningOutput } from "./types";

const names = shirtNames([
  { shirt_number: 9, first_name: "Jens", last_name: "De Smet", archived_at: null },
  { shirt_number: 5, first_name: "Bram", last_name: "Mertens", archived_at: "2026-01-01" },
]);

describe("withShirtNames", () => {
  it("adds names after shirt numbers it knows", () => {
    expect(withShirtNames("#9 en #5 rusten, #99 niet", names)).toBe("#9 J. De Smet en #5 rusten, #99 niet");
  });
});

describe("weekPlanningToText", () => {
  it("renders a shareable text", () => {
    const output: WeekPlanningOutput = {
      weekfocus: "Druk zetten.",
      dagen: [
        {
          datum: "2026-10-20",
          md: "MD-3",
          soort: "training",
          titel: "Intensieve dag",
          doel: "x",
          tijdstip: "19:30",
          totale_duur_min: 90,
          belasting: "hoog",
          onderdelen: [
            {
              fase: "kern",
              naam: "4v4",
              doel: "x",
              organisatie: "x",
              spelers: "4v4",
              coachingspunten: [],
              duur_min: 20,
              reeksen: 5,
              werk_per_reeks: "3 min",
              rust_tussen_reeksen: "2 min",
              intensiteit: "hoog",
              rpe: 8,
            },
          ],
          opmerking: null,
        },
        {
          datum: "2026-10-25",
          md: "MD",
          soort: "wedstrijd",
          titel: "Wedstrijd",
          doel: "x",
          tijdstip: "15:00",
          totale_duur_min: 90,
          belasting: "zeer hoog",
          onderdelen: [],
          opmerking: "Verzamelen 13u45.",
        },
      ],
      individueel: [{ rugnummer: 9, advies: "Apart programma." }],
      aandachtspunten: [],
      vragen_aan_coach: [],
    };
    const text = weekPlanningToText(output, { title: "Week van 19 oktober", names });
    expect(text).toContain("*dinsdag 20 oktober 2026 · MD-3 · 19:30 · 90 min*");
    expect(text).toContain("- Kern: 4v4 (20 min, 5 reeksen, 3 min, rust 2 min, hoog, RPE 8)");
    expect(text).toContain("- #9 J. De Smet: Apart programma.");
    expect(text).toContain("Verzamelen 13u45.");
  });
});

import { masDistance } from "./mas";

describe("masDistance", () => {
  it("computes the distance per repetition", () => {
    expect(masDistance(16, 100, 15)).toBe(67); // 4.44 m/s × 15 s
    expect(masDistance(18, 95, 30)).toBe(143);
  });
});
