import "server-only";

import { CLUB_PERSON_ROLES } from "@iassistent/db";
import ExcelJS from "exceljs";

import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import {
  type ClubSheets,
  MAX_PEOPLE,
  MAX_TEAMS,
  PEOPLE_COLUMNS,
  TEAM_COLUMNS,
} from "./import";

const m = messages.clubPeople.file;
const BRAND = "FF1F4E79";

export interface TemplateTeam {
  name: string;
  category: string | null;
  federationTeam: string | null;
}

export interface TemplatePerson {
  name: string;
  email: string;
  role: string;
  team: string;
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
 * The club file: sheets Teams and People with drop-down lists (category, team
 * in the competition export, role, team), a hidden sheet with the lists and a
 * sheet with help. Filled in with what the club has already.
 */
export async function clubFileTemplate(
  clubName: string,
  teams: TemplateTeam[],
  people: TemplatePerson[],
  federationTeams: string[],
): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = messages.app.name;
  const categories = messages.ageCategories as Record<string, string>;
  const roles = messages.clubPeople.roles;

  const help = book.addWorksheet(m.sheets.help);
  help.getColumn(1).width = 120;
  help.addRow([`${messages.app.name} — ${clubName}`]).font = {
    bold: true,
    size: 14,
  };
  for (const line of m.help) help.addRow([line]).alignment = { wrapText: true };

  const teamSheet = sheetWithHeader(
    book,
    m.sheets.teams,
    TEAM_COLUMNS.map((c) => m.columns[c]),
    [28, 18, 32],
  );
  for (const t of teams)
    teamSheet.addRow([
      t.name,
      t.category ? (categories[t.category] ?? "") : "",
      t.federationTeam ?? "",
    ]);

  const peopleSheet = sheetWithHeader(
    book,
    m.sheets.people,
    PEOPLE_COLUMNS.map((c) => m.columns[c]),
    [28, 32, 22, 28],
  );
  for (const p of people)
    peopleSheet.addRow([p.name, p.email, roles[p.role] ?? p.role, p.team]);

  // Lists for the drop-downs.
  const lists = book.addWorksheet(m.sheets.lists, { state: "hidden" });
  AGE_CATEGORIES.forEach((c, i) => (lists.getCell(i + 1, 1).value = categories[c]));
  CLUB_PERSON_ROLES.forEach((r, i) => (lists.getCell(i + 1, 2).value = roles[r]));
  federationTeams.forEach((f, i) => (lists.getCell(i + 1, 3).value = f));
  const list = (col: string, n: number, strict = true) => ({
    type: "list" as const,
    allowBlank: true,
    formulae: [`'${m.sheets.lists}'!$${col}$1:$${col}$${Math.max(n, 1)}`],
    showErrorMessage: strict,
  });

  for (let row = 2; row <= MAX_TEAMS + 1; row++) {
    teamSheet.getCell(row, 2).dataValidation = list("A", AGE_CATEGORIES.length);
    if (federationTeams.length)
      teamSheet.getCell(row, 3).dataValidation = list("C", federationTeams.length);
  }
  const teamNames = `'${m.sheets.teams}'!$A$2:$A$${MAX_TEAMS + 1}`;
  for (let row = 2; row <= MAX_PEOPLE + 1; row++) {
    peopleSheet.getCell(row, 3).dataValidation = list("B", CLUB_PERSON_ROLES.length);
    peopleSheet.getCell(row, 4).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [teamNames],
      showErrorMessage: false,
    };
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

/** The two sheets of a filled-in club file, or null when the file is not one. */
export async function readClubFile(
  data: ArrayBuffer,
): Promise<ClubSheets | null> {
  try {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(data);
    const teams = book.getWorksheet(m.sheets.teams);
    const people = book.getWorksheet(m.sheets.people);
    if (!teams || !people) return null;
    return { teams: cellsOf(teams), people: cellsOf(people) };
  } catch {
    return null;
  }
}
