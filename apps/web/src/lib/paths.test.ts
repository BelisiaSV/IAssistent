import { describe, expect, it } from "vitest";

import { safeNextPath } from "./paths";

describe("safeNextPath", () => {
  it("keeps relative paths", () => {
    expect(safeNextPath("/teams/new")).toBe("/teams/new");
  });

  it("falls back for missing or external targets", () => {
    expect(safeNextPath(null)).toBe("/teams");
    expect(safeNextPath("https://evil.example")).toBe("/teams");
    expect(safeNextPath("//evil.example")).toBe("/teams");
    expect(safeNextPath("/\\evil.example")).toBe("/teams");
  });
});
