import { describe, expect, it } from "vitest";

import { activeNav, NAV_ITEMS, tabHref } from "./navigation";

const team = "11111111-1111-4111-8111-111111111111";
const at = (path: string, query = "") => activeNav(path, new URLSearchParams(query), team);

describe("navigation", () => {
  it("has the eight menus of the head coach", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["dashboard", "team", "planning", "staff-room", "tasks", "match-analysis", "library", "reports"]);
  });

  it("finds the menu and tab of a page", () => {
    expect(at(`/teams/${team}`)?.item.key).toBe("dashboard");
    expect(at(`/teams/${team}/players/abc`)?.tab.teamPath).toBe("/players");
    expect(at("/profile/vision")?.item.key).toBe("team");
    expect(at(`/teams/${team}/reports`)?.tab.teamPath).toBe("/reports");
    expect(at(`/teams/${team}/reports/load`)?.tab.teamPath).toBe("/reports/load");
    expect(at(`/teams/${team}/weeks/2026-11-16`)?.item.key).toBe("planning");
    expect(at("/account")).toBeNull();
  });

  it("tells exercises and set pieces apart by the filter", () => {
    expect(at("/exercises")?.tab.href).toBe("/exercises");
    expect(at("/exercises", "soort=set_piece")?.tab.href).toBe("/exercises?soort=set_piece");
    expect(at("/exercises/abc")?.tab.href).toBe("/exercises");
    expect(at("/exercises/bank")?.tab.href).toBe("/exercises/bank");
    expect(at("/exercises/bank/OEF-007")?.tab.href).toBe("/exercises/bank");
  });

  it("only opens team tabs with a team", () => {
    const players = NAV_ITEMS[1]!.tabs[0]!;
    expect(tabHref(players, null)).toBeNull();
    expect(tabHref(players, team)).toBe(`/teams/${team}/players`);
  });
});
