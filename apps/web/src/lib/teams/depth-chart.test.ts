import type { FormationSlot, PositionCatalog } from "@iassistent/staff-engine/content";
import { describe, expect, it } from "vitest";

import { depthChart } from "./depth-chart";

const slots: FormationSlot[] = [
  { id: "GK", positie: "GK", x: 50, y: 90 },
  { id: "LCB", positie: "CB", x: 37, y: 75 },
  { id: "RCB", positie: "CB", x: 63, y: 75 },
  { id: "CM", positie: "CM", x: 50, y: 50 },
  { id: "ST", positie: "ST", x: 50, y: 15 },
];
const positions = {
  versie: "1",
  linies: [],
  posities: [
    { code: "GK", naam: "", linie: "doel" },
    { code: "CB", naam: "", linie: "verdediging" },
    { code: "LB", naam: "", linie: "verdediging" },
    { code: "CM", naam: "", linie: "middenveld" },
    { code: "CAM", naam: "", linie: "middenveld" },
    { code: "ST", naam: "", linie: "aanval" },
  ],
} as unknown as PositionCatalog;

const p = (id: string, primaryPosition: string | null, secondaryPositions: string[] = []) => ({ id, primaryPosition, secondaryPositions });

describe("depth chart", () => {
  it("puts players on their position, shares equal slots and falls back to other positions and the line", () => {
    const chart = depthChart(
      [p("a", "CB"), p("b", "CB"), p("c", "CB"), p("d", "LB"), p("e", "CAM", ["ST"]), p("f", "CAM"), p("g", null), p("h", "XX")],
      slots,
      positions,
    );
    const ids = (slot: string) => chart.slots.get(slot)!.map((x) => x.id);
    expect(ids("LCB")).toEqual(["a", "c"]);
    expect(ids("RCB")).toEqual(["b", "d"]);
    expect(ids("ST")).toEqual(["e"]);
    expect(ids("CM")).toEqual(["f"]);
    expect(ids("GK")).toEqual([]);
    expect(chart.unplaced.map((x) => x.id)).toEqual(["g", "h"]);
  });
});
