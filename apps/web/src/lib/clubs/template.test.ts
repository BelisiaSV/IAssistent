import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { messages } from "@/lib/messages";

import { hasErrors, parseClubImport } from "./import";
import { clubTemplate, readClubFile } from "./template";

const sheets = messages.clubAdmin.excel.sheets;

describe("club template", () => {
  it("round-trips: a filled-in template reads back into club, teams and staff", async () => {
    const file = await clubTemplate(
      {
        name: "Belisia Bilzen SV",
        number: "00042",
        address: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
        primaryColor: "#6CB4EE",
        secondaryColor: null,
      },
      [
        {
          name: "Belisia Bilzen SV A",
          ageCategory: "senioren",
          season: null,
          federationTeam: "Belisia Bilzen SV A",
          divisions: ["3B"],
        },
      ],
    );

    // The club fills in a staff member.
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file as unknown as ArrayBuffer);
    expect(book.getWorksheet(sheets.lists)?.state).toBe("hidden");
    const staff = book.getWorksheet(sheets.staff)!;
    staff.getRow(2).values = [
      "Tom",
      messages.clubAdmin.roles.coach,
      "Belisia Bilzen SV A",
      messages.clubAdmin.teamRoles.head_coach,
    ];
    const filled = await book.xlsx.writeBuffer();

    const read = await readClubFile(filled as ArrayBuffer);
    expect(read).not.toBeNull();
    const data = parseClubImport(read!);
    if ("error" in data) throw new Error(data.error);
    expect(hasErrors(data)).toBe(false);
    expect(data.club.name).toBe("Belisia Bilzen SV");
    expect(data.teams).toHaveLength(1);
    expect(data.teams[0]!.ageCategory).toBe("senioren");
    expect(data.staff[0]).toMatchObject({
      name: "Tom",
      role: "coach",
      teamRole: "head_coach",
    });
  });

  it("reads null for a file that is not the template", async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet("Iets anders");
    expect(
      await readClubFile((await book.xlsx.writeBuffer()) as ArrayBuffer),
    ).toBeNull();
  });
});
