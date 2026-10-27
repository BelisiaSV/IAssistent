import type { Tables } from "@iassistent/db";
import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { messages } from "@/lib/messages";

import { parseImportRows } from "./import";
import { playerTemplate, readImportFile } from "./template";

const positions = [
  { code: "GK", naam: "Doelman", linie: "doel" },
  { code: "ST", naam: "Spits", linie: "aanval" },
];

describe("player template", () => {
  it("round-trips: a filled-in template reads back into players", async () => {
    const existing: Tables<"players"> = {
      id: "p1",
      team_id: "t",
      first_name: "Jan",
      last_name: "Peeters",
      shirt_number: 9,
      primary_position: "ST",
      secondary_positions: [],
      preferred_foot: "left",
      joined_club_year: 2020,
      expected_return_date: null,
      archived_at: null,
      birth_year: 2001,
      status: "available",
      notes: null,
      created_at: "",
      updated_at: "",
    };
    const file = await playerTemplate(positions, [existing], new Date("2026-10-27T12:00:00Z"));

    // The coach adds a goalkeeper in the next row.
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file as unknown as ArrayBuffer);
    const sheet = book.getWorksheet(messages.playerImport.sheets.players)!;
    expect(sheet.getCell("D2").dataValidation?.type).toBe("list");
    sheet.getRow(3).values = [1, "Tom", "Claes", "GK", "", "Rechts", 1998, 2019, "Beschikbaar", "", ""];
    const edited = await book.xlsx.writeBuffer();

    const cells = await readImportFile(edited as ArrayBuffer);
    const result = parseImportRows(cells!, positions.map((p) => p.code), new Date("2026-10-27T12:00:00Z"));
    if ("error" in result) throw new Error(result.error);
    expect(result.rows.map((r) => [r.player?.shirtNumber, r.player?.lastName, r.player?.preferredFoot, r.errors.length])).toEqual([
      [9, "Peeters", "left", 0],
      [1, "Claes", "right", 0],
    ]);
  });

  it("refuses a file that is not a spreadsheet", async () => {
    expect(await readImportFile(new TextEncoder().encode("geen excel").buffer as ArrayBuffer)).toBeNull();
  });
});
