import { describe, expect, it } from "vitest";

import { bankFilterOptions, bankFilters, bankZones, filterBank } from "./filters";
import type { BankRow } from "./staff";

const row = (number: string, over: Partial<BankRow> = {}, content: Record<string, unknown> = {}): BankRow => ({
  number,
  title: `Oefening ${number}`,
  kind: "Positiespel",
  phase: "Balbezit",
  target_group: null,
  tags: [],
  principles: [],
  content: { belasting: "Middel", zones: [4, 5, 6], ...content },
  ...over,
});

const rows = [
  row("OEF-001", { kind: "Rondo", principles: ["Linies doorbreken"] }, { zones: [1, 2, 3], belasting: "Laag" }),
  row("OEF-002", { phase: "Balverlies", title: "Pressing na balverlies" }, { bron: "Training 05-11" }),
  row("OEF-003", { principles: ["Linies doorbreken", "Breedte"] }, { zones: [16, 17, 18, 99] }),
];

describe("filterBank", () => {
  const all = bankFilters({});

  it("filters on phase, type, load, principle and zone", () => {
    expect(filterBank(rows, { ...all, fase: "Balverlies" }).map((r) => r.number)).toEqual(["OEF-002"]);
    expect(filterBank(rows, { ...all, type: "Rondo" }).map((r) => r.number)).toEqual(["OEF-001"]);
    expect(filterBank(rows, { ...all, belasting: "Laag" }).map((r) => r.number)).toEqual(["OEF-001"]);
    expect(filterBank(rows, { ...all, principe: "Linies doorbreken" }).map((r) => r.number)).toEqual(["OEF-001", "OEF-003"]);
    expect(filterBank(rows, { ...all, zone: "17" }).map((r) => r.number)).toEqual(["OEF-003"]);
  });

  it("searches the title and the source", () => {
    expect(filterBank(rows, { ...all, q: "pressing" }).map((r) => r.number)).toEqual(["OEF-002"]);
    expect(filterBank(rows, { ...all, q: "training" }).map((r) => r.number)).toEqual(["OEF-002"]);
  });

  it("lists the options and the valid zones", () => {
    expect(bankFilterOptions(rows)).toMatchObject({ fase: ["Balbezit", "Balverlies"], belasting: ["Laag", "Middel"], principe: ["Breedte", "Linies doorbreken"] });
    expect(bankZones(rows[2]!)).toEqual([16, 17, 18]);
  });
});
