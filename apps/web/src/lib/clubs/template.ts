import "server-only";

import { CLUB_ROLES, TEAM_STAFF_ROLES } from "@iassistent/db";
import ExcelJS from "exceljs";

import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import {
  CLUB_COLUMNS,
  type ClubSheets,
  MAX_STAFF,
  MAX_TEAMS,
  STAFF_COLUMNS,
  TEAM_COLUMNS,
} from "./import";

const m = messages.clubAdmin.excel;
const BRAND = "FF1F4E79";

export interface TemplateClub {
  name: string;
  number: string | null;
  address: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface TemplateTeam {
  name: string;
  ageCategory: string | null;
  season: string | null;
  federationTeam: string | null;
  divisions: string[];
}

function sheetWithHeader(
  book: ExcelJS.Workbook,
  name: string,
  headers: string[],
  widths: number[],
) {
  const sheet = book.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = headers.map((header, i) => ({
    header,
    width: widths[i] ?? 18,
  }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  head.height = 22;
  return sheet;
}

/**
 * The Excel a club fills in: sheets Club (one row), Teams and Staff with
 * drop-down lists, a hidden sheet with the lists and a sheet with help. The
 * club's details and its teams (the club's own and those of the competition
 * export) are filled in already.
 */
export async function clubTemplate(
  club: TemplateClub,
  teams: TemplateTeam[],
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = messages.app.name;

  const help = book.addWorksheet(m.sheets.help);
  help.getColumn(1).width = 120;
  help.addRow([`${messages.app.name} — ${club.name}`]).font = {
    bold: true,
    size: 14,
  };
  for (const line of m.help) help.addRow([line]).alignment = { wrapText: true };

  const clubSheet = sheetWithHeader(
    book,
    m.sheets.club,
    CLUB_COLUMNS.map((c) => m.columns[c]),
    [28, 12, 32, 22, 28, 16, 20, 20],
  );
  clubSheet.addRow([
    club.name,
    club.number ?? "",
    club.address ?? "",
    club.contactName ?? "",
    club.contactEmail ?? "",
    club.contactPhone ?? "",
    club.primaryColor ?? "",
    club.secondaryColor ?? "",
  ]);

  const teamSheet = sheetWithHeader(
    book,
    m.sheets.teams,
    TEAM_COLUMNS.map((c) => m.columns[c]),
    [24, 20, 12, 30, 16],
  );
  for (const t of teams) {
    teamSheet.addRow([
      t.name,
      t.ageCategory
        ? ((messages.ageCategories as Record<string, string>)[t.ageCategory] ??
          "")
        : "",
      t.season ?? "",
      t.federationTeam ?? "",
      t.divisions.join(", "),
    ]);
  }

  const staffSheet = sheetWithHeader(
    book,
    m.sheets.staff,
    STAFF_COLUMNS.map((c) => m.columns[c]),
    [28, 22, 24, 20],
  );

  // Lists for the drop-downs.
  const lists = book.addWorksheet(m.sheets.lists, { state: "hidden" });
  AGE_CATEGORIES.forEach(
    (c, i) =>
      (lists.getCell(i + 1, 1).value = (
        messages.ageCategories as Record<string, string>
      )[c]),
  );
  CLUB_ROLES.forEach(
    (r, i) => (lists.getCell(i + 1, 2).value = messages.clubAdmin.roles[r]),
  );
  TEAM_STAFF_ROLES.forEach(
    (r, i) => (lists.getCell(i + 1, 3).value = messages.clubAdmin.teamRoles[r]),
  );
  const list = (col: string, n: number) => ({
    type: "list" as const,
    allowBlank: true,
    formulae: [`'${m.sheets.lists}'!$${col}$1:$${col}$${n}`],
    showErrorMessage: true,
  });
  const teamNames = `'${m.sheets.teams}'!$A$2:$A$${MAX_TEAMS + 1}`;

  for (let row = 2; row <= MAX_TEAMS + 1; row++) {
    teamSheet.getCell(
      row,
      TEAM_COLUMNS.indexOf("ageCategory") + 1,
    ).dataValidation = list("A", AGE_CATEGORIES.length);
  }
  for (let row = 2; row <= MAX_STAFF + 1; row++) {
    staffSheet.getCell(row, STAFF_COLUMNS.indexOf("role") + 1).dataValidation =
      list("B", CLUB_ROLES.length);
    staffSheet.getCell(row, STAFF_COLUMNS.indexOf("team") + 1).dataValidation =
      {
        type: "list",
        allowBlank: true,
        formulae: [teamNames],
        showErrorMessage: false,
      };
    staffSheet.getCell(
      row,
      STAFF_COLUMNS.indexOf("teamRole") + 1,
    ).dataValidation = list("C", TEAM_STAFF_ROLES.length);
  }

  return Buffer.from(await book.xlsx.writeBuffer());
}

function cellsOf(sheet: ExcelJS.Worksheet | undefined): unknown[][] {
  if (!sheet) return [];
  const cells: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, n) => {
    cells[n - 1] = (row.values as unknown[]).slice(1);
  });
  return Array.from({ length: cells.length }, (_, i) => cells[i] ?? []);
}

/** The three sheets of a filled-in template, or null when the file is not one. */
export async function readClubFile(
  data: ArrayBuffer,
): Promise<ClubSheets | null> {
  try {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(data);
    const club = book.getWorksheet(m.sheets.club);
    const teams = book.getWorksheet(m.sheets.teams);
    const staff = book.getWorksheet(m.sheets.staff);
    if (!club || !teams || !staff) return null;
    return {
      club: cellsOf(club),
      teams: cellsOf(teams),
      staff: cellsOf(staff),
    };
  } catch {
    return null;
  }
}
