import { describe, expect, it } from "vitest";

import { periodFor, periodsBetween } from "./periods";

const base = { focus: null, goals: ["Positiespel"] };
const all = { ...base, title: "Iedereen", starts_on: "2026-09-01", ends_on: "2026-10-31", age_categories: [] };
const u17 = { ...base, title: "U17", starts_on: "2026-09-15", ends_on: "2026-10-15", age_categories: ["u17", "u19"] };

describe("club periods", () => {
  it("prefers a period for the age category over one for every category", () => {
    expect(periodFor([all, u17], "u17")?.titel).toBe("U17");
    expect(periodFor([all, u17], "senioren")?.titel).toBe("Iedereen");
    expect(periodFor([u17], "senioren")).toBeNull();
    expect(periodFor([u17], "u19")).toEqual({ titel: "U17", van: "2026-09-15", tot: "2026-10-15", trainingsdoelen: ["Positiespel"], focus: null });
  });

  it("finds the periods that touch a range, in order", () => {
    expect(periodsBetween([u17, all], "2026-10-20", "2026-10-26").map((p) => p.title)).toEqual(["Iedereen"]);
    expect(periodsBetween([u17, all], "2026-10-01", "2026-10-31").map((p) => p.title)).toEqual(["Iedereen", "U17"]);
  });
});
