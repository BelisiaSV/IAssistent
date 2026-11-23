import { describe, expect, it } from "vitest";

import { trainingDays, trainingDaySnapshot } from "./knowledge";

const output = {
  dagen: [
    { datum: "2026-11-16", soort: "rust", titel: "Rust", onderdelen: [] },
    {
      datum: "2026-11-17",
      soort: "training",
      titel: "Positiespel",
      md: "MD-4",
      onderdelen: [{ fase: "kern", naam: "Rondo", coachingspunten: ["Open lichaam"], oefening_id: "abc" }],
      opmerking: "#7 en Jan Peeters extra lopen",
    },
  ],
  individueel: [{ rugnummer: 7 }],
};

describe("shared trainings", () => {
  it("takes only the training of that day, without remarks or own exercise links", () => {
    const snap = trainingDaySnapshot(output, "2026-11-17")!;
    expect(snap.titel).toBe("Positiespel");
    expect(snap.onderdelen[0]!.oefening_id).toBeNull();
    expect(JSON.stringify(snap)).not.toContain("Jan Peeters");
    expect(trainingDaySnapshot(output, "2026-11-16")).toBeNull();
  });

  it("lists the training days", () => {
    expect(trainingDays(output)).toEqual([{ datum: "2026-11-17", titel: "Positiespel" }]);
  });
});
