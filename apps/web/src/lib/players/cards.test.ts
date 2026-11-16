import { describe, expect, it } from "vitest";

import { suspensions, yellowCounts } from "./cards";

const rules = { yellowLimit: 3, yellowBan: 1, redBan: 2 };
const y = (date: string, player = "p") => ({ player_id: player, match_date: date, card: "yellow" as const });
const r = (date: string, player = "p") => ({ player_id: player, match_date: date, card: "red" as const });

describe("suspensions", () => {
  it("suspends at every n-th yellow card until the next match is played", () => {
    const cards = [y("2026-09-06"), y("2026-09-13"), y("2026-09-20")];
    expect(suspensions(cards, ["2026-09-06", "2026-09-13", "2026-09-20"], rules, null).get("p")).toEqual({ matches: 1, reason: "yellow", yellows: 3 });
    expect(suspensions(cards, ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"], rules, null).has("p")).toBe(false);
    expect(suspensions(cards.slice(0, 2), ["2026-09-20"], rules, null).has("p")).toBe(false);
  });

  it("serves bans one after the other and counts a red card", () => {
    const cards = [r("2026-10-04"), y("2026-09-06"), y("2026-09-13"), y("2026-10-04")];
    const played = ["2026-09-06", "2026-09-13", "2026-10-04", "2026-10-11"];
    // 3rd yellow (1 match) and red (2 matches) on 4/10; one match played since.
    expect(suspensions(cards, played, rules, null).get("p")?.matches).toBe(2);
  });

  it("only counts the cards of this season", () => {
    const cards = [y("2026-05-01"), y("2026-09-06"), y("2026-09-13")];
    expect(suspensions(cards, [], rules, "2026-09-01").has("p")).toBe(false);
    expect(yellowCounts(cards, "2026-09-01").get("p")).toBe(2);
  });
});
