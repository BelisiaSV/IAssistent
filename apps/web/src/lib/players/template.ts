import "server-only";

import type { Tables } from "@iassistent/db";
import type { Position } from "@iassistent/staff-engine/content";
import ExcelJS from "exceljs";

import { messages } from "@/lib/messages";

import { IMPORT_COLUMNS, type ImportColumn, MAX_IMPORT_ROWS } from "./import";
import { PLAYER_STATUSES, PREFERRED_FEET } from "./validation";

const m = messages.playerImport;
const BRAND = "FF1F4E79";

const WIDTHS: Record<ImportColumn, number> = {
  shirtNumber: 11,
  firstName: 16,
  lastName: 20,
  primaryPosition: 14,
  secondaryPositions: 18,
  preferredFoot: 15,
  birthYear: 13,
  joinedClubYear: 16,
  status: 14,
  expectedReturnDate: 19,
  notes: 36,
};

/**
 * The Excel template for the player import: a sheet Spelers with drop-down
 * lists (positions, foot, status) and checks on numbers and dates, a sheet with
 * the positions, a hidden sheet with the lists and a sheet with instructions.
 * With `players`, the current squad is filled in so the coach only edits it.
 */
export async function playerTemplate(positions: Position[], players: Tables<"players">[] = [], today = new Date()): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  book.creator = messages.app.name;
  const year = today.getFullYear();

  const sheet = book.addWorksheet(m.sheets.players, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((col) => ({ header: m.columns[col], key: col, width: WIDTHS[col] }));
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  head.alignment = { vertical: "middle" };
  head.height = 22;

  for (const p of players) {
    sheet.addRow({
      shirtNumber: p.shirt_number ?? "",
      firstName: p.first_name,
      lastName: p.last_name,
      primaryPosition: p.primary_position ?? "",
      secondaryPositions: p.secondary_positions.join(", "),
      preferredFoot: p.preferred_foot ? messages.players.foot[p.preferred_foot] : "",
      birthYear: p.birth_year ?? "",
      joinedClubYear: p.joined_club_year ?? "",
      status: messages.players.status[p.status],
      expectedReturnDate: p.expected_return_date ?? "",
      notes: p.notes ?? "",
    });
  }

  // Lists for the drop-downs (hidden sheet), and the positions with their names.
  const lists = book.addWorksheet(m.sheets.lists, { state: "hidden" });
  positions.forEach((p, i) => (lists.getCell(i + 1, 1).value = p.code));
  PREFERRED_FEET.forEach((f, i) => (lists.getCell(i + 1, 2).value = messages.players.foot[f]));
  PLAYER_STATUSES.forEach((s, i) => (lists.getCell(i + 1, 3).value = messages.players.status[s]));
  const range = (col: string, n: number) => `'${m.sheets.lists}'!$${col}$1:$${col}$${n}`;

  const column = (col: ImportColumn) => IMPORT_COLUMNS.indexOf(col) + 1;
  for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
    const cell = (col: ImportColumn) => sheet.getCell(row, column(col));
    const whole = (min: number, max: number) => ({
      type: "whole" as const,
      operator: "between" as const,
      allowBlank: true,
      formulae: [min, max],
      showErrorMessage: true,
      error: `${min} – ${max}`,
    });
    const list = (formula: string) => ({ type: "list" as const, allowBlank: true, formulae: [formula], showErrorMessage: true });
    cell("shirtNumber").dataValidation = whole(1, 99);
    cell("primaryPosition").dataValidation = list(range("A", positions.length));
    cell("preferredFoot").dataValidation = list(range("B", PREFERRED_FEET.length));
    cell("birthYear").dataValidation = whole(1940, year);
    cell("joinedClubYear").dataValidation = whole(1950, year + 1);
    cell("status").dataValidation = list(range("C", PLAYER_STATUSES.length));
    cell("expectedReturnDate").numFmt = "dd/mm/yyyy";
  }

  const positionSheet = book.addWorksheet(m.sheets.positions);
  positionSheet.columns = [
    { header: m.columns.primaryPosition, key: "code", width: 14 },
    { header: "", key: "naam", width: 28 },
  ];
  positionSheet.getRow(1).font = { bold: true };
  for (const p of positions) positionSheet.addRow({ code: p.code, naam: p.naam });

  const help = book.addWorksheet(m.sheets.help);
  help.getColumn(1).width = 110;
  help.addRow([m.title]).font = { bold: true, size: 14 };
  for (const line of m.help) help.addRow([line]).alignment = { wrapText: true };

  return Buffer.from(await book.xlsx.writeBuffer());
}

/** The rows of the Spelers sheet (or the first sheet) as plain cell values, headers first. */
export async function readImportFile(data: ArrayBuffer): Promise<unknown[][] | null> {
  try {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(data);
    const sheet = book.getWorksheet(m.sheets.players) ?? book.worksheets[0];
    if (!sheet) return null;
    const cells: unknown[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, n) => {
      cells[n - 1] = (row.values as unknown[]).slice(1);
    });
    return Array.from({ length: cells.length }, (_, i) => cells[i] ?? []);
  } catch {
    return null;
  }
}
