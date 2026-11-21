import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { loadStaff } from "../src/load";
import { exampleProvider } from "../src/providers/example";
import { qualityProblems, runQualityCheck } from "../src/quality";
import { parseQualityCriteria, qualityVerdict } from "../src/shared/quality";
import type { Staff } from "../src/types";

let staff: Staff;
beforeAll(async () => {
  staff = await loadStaff(path.resolve(__dirname, "../../../staff"));
});

describe("Training Quality Engine", () => {
  it("checks a week in test mode with the example and computes average and verdict", async () => {
    const result = await runQualityCheck(staff, { visie: null, weekinput: {}, kern: [], voorstel: {} }, exampleProvider);
    expect(result.output.criteria.map((c) => c.code).sort()).toEqual(staff.quality.criteria.map((c) => c.code).sort());
    expect(result.average).toBeGreaterThanOrEqual(1);
    expect(result.average).toBeLessThanOrEqual(5);
    expect(staff.quality.oordelen.map((o) => o.code)).toContain(result.verdict);
  });

  it("refuses an answer that misses or repeats a criterion", () => {
    const [first, ...rest] = staff.quality.criteria;
    const output = {
      samenvatting: "x",
      criteria: [...rest, rest[0]!].map((c) => ({ code: c.code, score: 3, toelichting: "x" })),
      sterke_punten: [],
      verbeterpunten: [{ criterium: "onbekend", punt: "x" }],
    };
    const problems = qualityProblems(staff, output);
    expect(problems.some((p) => p.includes(first!.code))).toBe(true);
    expect(problems.some((p) => p.includes(rest[0]!.code))).toBe(true);
    expect(problems.some((p) => p.includes("onbekend"))).toBe(true);
  });

  it("picks the verdict from the thresholds and validates the criteria file", () => {
    expect(qualityVerdict(staff.quality, 4.2).code).toBe(staff.quality.oordelen[0]!.code);
    expect(qualityVerdict(staff.quality, 1).code).toBe(staff.quality.oordelen.at(-1)!.code);
    const bad = parseQualityCriteria({
      ...staff.quality,
      criteria: [staff.quality.criteria[0], staff.quality.criteria[0]],
    });
    expect(bad.value).toBeNull();
  });
});
