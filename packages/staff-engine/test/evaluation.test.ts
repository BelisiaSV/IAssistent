import { describe, expect, it } from "vitest";

import { parseEvaluationCatalog, recurringPoints } from "../src/shared/evaluation";

const catalog = {
  versie: "1",
  beoordeling: { min: 1, max: 5, labels: {} },
  aandachtspunten: [
    { code: "intensiteit", naam: "Intensiteit" },
    { code: "omschakeling", naam: "Omschakeling" },
    { code: "afwerking", naam: "Afwerking" },
  ],
};

describe("evaluation catalog", () => {
  it("counts attention points that come back, most frequent first", () => {
    const parsed = parseEvaluationCatalog(catalog).value!;
    const evaluations = [
      { attention_points: ["omschakeling", "intensiteit"] },
      { attention_points: ["omschakeling", "omschakeling"] },
      { attention_points: ["intensiteit", "omschakeling"] },
      { attention_points: ["afwerking"] },
    ];
    expect(recurringPoints(evaluations, parsed)).toEqual([
      { code: "omschakeling", naam: "Omschakeling", aantal: 3 },
      { code: "intensiteit", naam: "Intensiteit", aantal: 2 },
    ]);
  });

  it("refuses duplicate codes", () => {
    expect(parseEvaluationCatalog({ ...catalog, aandachtspunten: [catalog.aandachtspunten[0], catalog.aandachtspunten[0]] }).value).toBeNull();
  });
});
