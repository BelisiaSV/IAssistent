import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { messages } from "@/lib/messages";

import { hasErrors, parseClubFile } from "./import";
import { clubFileTemplate, readClubFile } from "./template";

const sheets = messages.clubPeople.file.sheets;

describe("club file", () => {
  it("round-trips: a filled-in club file reads back into teams and people", async () => {
    const file = await clubFileTemplate(
      "Belisia Bilzen SV",
      [{ name: "Belisia Bilzen SV A", category: "senioren", federationTeam: "Belisia Bilzen SV A" }],
      [{ name: "Ann", email: "ann@club.be", role: "club_manager", team: "" }],
      ["Belisia Bilzen SV A"],
    );

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file as unknown as ArrayBuffer);
    expect(book.getWorksheet(sheets.lists)?.state).toBe("hidden");
    book.getWorksheet(sheets.people)!.getRow(3).values = [
      "Tom",
      "tom@club.be",
      messages.clubPeople.roles.head_coach,
      "Belisia Bilzen SV A",
    ];
    const filled = await book.xlsx.writeBuffer();

    const read = await readClubFile(filled as ArrayBuffer);
    expect(read).not.toBeNull();
    const data = parseClubFile(read!, [], ["Belisia Bilzen SV A"]);
    if ("error" in data) throw new Error(data.error);
    expect(hasErrors(data)).toBe(false);
    expect(data.teams[0]).toMatchObject({ category: "senioren", federationTeam: "Belisia Bilzen SV A" });
    expect(data.people).toHaveLength(2);
    expect(data.people[0]).toMatchObject({ role: "club_manager" });
    expect(data.people[1]).toMatchObject({ name: "Tom", role: "head_coach", team: "Belisia Bilzen SV A" });
  });

  it("reads null for a file that is not the club file", async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Iets anders");
    expect(await readClubFile((await book.xlsx.writeBuffer()) as ArrayBuffer)).toBeNull();
  });
});
