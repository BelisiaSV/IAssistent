import { describe, expect, it } from "vitest";

import { currentSeasonStartYear, formatSeason, seasonsAtClub } from "./season";

describe("season helpers", () => {
  it("starts a new season in July", () => {
    expect(currentSeasonStartYear(new Date(2026, 5, 30))).toBe(2025);
    expect(currentSeasonStartYear(new Date(2026, 6, 1))).toBe(2026);
  });

  it("formats a season", () => {
    expect(formatSeason(2026)).toBe("2026-2027");
  });

  it("counts seasons at the club including the current one", () => {
    const today = new Date(2026, 9, 13); // season 2026-2027
    expect(seasonsAtClub(2026, today)).toBe(1);
    expect(seasonsAtClub(2019, today)).toBe(8);
    expect(seasonsAtClub(2030, today)).toBe(1);
  });
});
