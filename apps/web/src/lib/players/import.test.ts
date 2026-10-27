import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import { cellText, parseImportRows, toImportPayload } from "./import";

const c = messages.playerImport.columns;
const header = [c.shirtNumber, c.firstName, c.lastName, c.primaryPosition, c.secondaryPositions, c.preferredFoot, c.birthYear, c.joinedClubYear, c.status, c.expectedReturnDate, c.notes];
const codes = ["GK", "CB", "CM", "CAM", "ST"];
const today = new Date("2026-10-27T12:00:00Z");

describe("player import", () => {
  it("reads labels, codes, dates and lists into players", () => {
    const result = parseImportRows(
      [
        header,
        [9, "Jan", "Peeters", "ST – Spits", "CAM, cm", "Links", 2001, "2020", "Geblesseerd", new Date("2026-11-15T00:00:00Z"), ""],
        [{ richText: [{ text: "4" }] }, "Lars", "Maes", "cb", "", "right", "", "", "", "", "Kopsterk"],
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["", "Zonder", "Nummer", "", "", "", "", "", "beschikbaar", "15/11/2026", ""],
      ],
      codes,
      today,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.rows.map((r) => r.line)).toEqual([2, 3, 5]);
    expect(result.rows.every((r) => r.errors.length === 0)).toBe(true);
    expect(result.rows[0]!.player).toMatchObject({
      shirtNumber: 9,
      primaryPosition: "ST",
      secondaryPositions: ["CAM", "CM"],
      preferredFoot: "left",
      birthYear: 2001,
      joinedClubYear: 2020,
      status: "injured",
      expectedReturnDate: "2026-11-15",
    });
    expect(result.rows[1]!.player).toMatchObject({ shirtNumber: 4, primaryPosition: "CB", preferredFoot: "right", status: "available", notes: "Kopsterk" });
    // Not injured → no return date.
    expect(result.rows[2]!.player).toMatchObject({ shirtNumber: null, expectedReturnDate: null });
    expect(toImportPayload(result.rows[0]!.player!)).toMatchObject({ first_name: "Jan", shirt_number: 9, secondary_positions: ["CAM", "CM"] });
  });

  it("reports every wrong row", () => {
    const result = parseImportRows(
      [
        header,
        [9, "", "Peeters", "XX", "", "hand", "", "", "moe", "", ""],
        [10, "A", "B", "", "", "", "", "", "", "", ""],
        [10, "C", "D", "", "", "", "", "", "", "", ""],
      ],
      codes,
      today,
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.rows[0]!.player).toBeNull();
    expect(result.rows[0]!.errors).toEqual(
      expect.arrayContaining([messages.playerImport.errors.foot, messages.playerImport.errors.status, messages.players.errors.firstNameRequired, messages.players.errors.position]),
    );
    expect(result.rows[1]!.errors).toContain(messages.playerImport.errors.duplicateNumber(10));
    expect(result.rows[2]!.errors).toContain(messages.playerImport.errors.duplicateNumber(10));
  });

  it("refuses a sheet without the template headers or without players", () => {
    expect(parseImportRows([["Naam", "Nummer"], ["Jan", 9]], codes, today)).toHaveProperty("error");
    expect(parseImportRows([header], codes, today)).toEqual({ error: messages.playerImport.errors.empty });
  });

  it("turns spreadsheet cells into text", () => {
    expect(cellText(null)).toBe("");
    expect(cellText(12)).toBe("12");
    expect(cellText({ result: 7 })).toBe("7");
    expect(cellText({ text: " ST " })).toBe("ST");
  });
});
