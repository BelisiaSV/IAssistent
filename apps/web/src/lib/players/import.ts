import { messages } from "@/lib/messages";

import { PLAYER_STATUSES, type PlayerInput, playerInputSchema, PREFERRED_FEET } from "./validation";

const m = messages.playerImport;

/** Columns of the import sheet, in order (the headers are in messages). */
export const IMPORT_COLUMNS = [
  "shirtNumber",
  "firstName",
  "lastName",
  "primaryPosition",
  "secondaryPositions",
  "preferredFoot",
  "birthYear",
  "joinedClubYear",
  "status",
  "expectedReturnDate",
  "notes",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

const REQUIRED: ImportColumn[] = ["firstName", "lastName"];
export const MAX_IMPORT_ROWS = 200;

export interface ImportRow {
  /** Row number in the sheet (1 = headers). */
  line: number;
  player: PlayerInput | null;
  errors: string[];
}

export type ImportResult = { error: string } | { rows: ImportRow[] };

/** A cell from the spreadsheet library as plain text (numbers, dates, rich text, formulas). */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  if (typeof value === "object") {
    const v = value as { richText?: { text: string }[]; text?: unknown; result?: unknown };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("").trim();
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
  }
  return String(value).trim();
}

const normal = (s: string) => s.trim().toLowerCase();

/** "ST", "st" or "ST – Spits" → "ST". */
function positionCode(text: string) {
  return text.trim().split(/\s+[–-]\s+|\s+/)[0]!.toUpperCase();
}

/** A label from the lists (Dutch) or the code itself → the code. */
function fromLabel<T extends string>(text: string, codes: readonly T[], labels: Record<T, string>): T | "" | null {
  if (!text.trim()) return "";
  const t = normal(text);
  return codes.find((c) => normal(c) === t || normal(labels[c]) === t) ?? null;
}

/** "15/11/2026", "15-11-2026" or "2026-11-15" → "2026-11-15"; other text stays as is. */
function isoDate(text: string) {
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  return dmy ? `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}` : text.trim();
}

/**
 * Reads the rows of the import sheet (first row = headers, as in the
 * template) into validated players. Every row gets its own errors, so the
 * admin sees all problems at once; nothing is imported while one row is wrong.
 */
export function parseImportRows(cells: unknown[][], positionCodes: readonly string[], today = new Date()): ImportResult {
  const header = (cells[0] ?? []).map((c) => normal(cellText(c)));
  const index = Object.fromEntries(IMPORT_COLUMNS.map((col) => [col, header.indexOf(normal(m.columns[col]))])) as Record<ImportColumn, number>;
  const missing = REQUIRED.filter((col) => index[col] < 0);
  if (missing.length) return { error: m.errors.headers(missing.map((c) => m.columns[c]).join(", ")) };

  const schema = playerInputSchema(positionCodes, today);
  const rows: ImportRow[] = [];
  cells.slice(1).forEach((cellRow, i) => {
    const get = (col: ImportColumn) => (index[col] >= 0 ? cellText(cellRow[index[col]]) : "");
    if (IMPORT_COLUMNS.every((col) => get(col) === "")) return;

    const errors: string[] = [];
    const foot = fromLabel(get("preferredFoot"), PREFERRED_FEET, messages.players.foot);
    const status = fromLabel(get("status"), PLAYER_STATUSES, messages.players.status);
    if (foot === null) errors.push(m.errors.foot);
    if (status === null) errors.push(m.errors.status);

    const parsed = schema.safeParse({
      firstName: get("firstName"),
      lastName: get("lastName"),
      shirtNumber: get("shirtNumber"),
      primaryPosition: get("primaryPosition") ? positionCode(get("primaryPosition")) : "",
      secondaryPositions: get("secondaryPositions")
        .split(/[,;/]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map(positionCode),
      preferredFoot: foot ?? "",
      birthYear: get("birthYear"),
      joinedClubYear: get("joinedClubYear"),
      status: status || "available",
      expectedReturnDate: get("expectedReturnDate") ? isoDate(get("expectedReturnDate")) : "",
      notes: get("notes"),
    });
    if (!parsed.success) errors.push(...new Set(parsed.error.issues.map((issue) => issue.message)));
    rows.push({ line: i + 2, player: parsed.success && !errors.length ? parsed.data : null, errors });
  });

  if (!rows.length) return { error: m.errors.empty };
  if (rows.length > MAX_IMPORT_ROWS) return { error: m.errors.tooMany };

  const seen = new Map<number, number>();
  for (const row of rows) {
    const n = row.player?.shirtNumber;
    if (n === null || n === undefined) continue;
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  for (const row of rows) {
    const n = row.player?.shirtNumber;
    if (n !== null && n !== undefined && seen.get(n)! > 1) row.errors.push(m.errors.duplicateNumber(n));
  }
  return { rows };
}

/** A validated player as the admin import function expects it. */
export function toImportPayload(p: PlayerInput) {
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    shirt_number: p.shirtNumber,
    primary_position: p.primaryPosition,
    secondary_positions: p.secondaryPositions,
    preferred_foot: p.preferredFoot,
    birth_year: p.birthYear,
    joined_club_year: p.joinedClubYear,
    status: p.status,
    expected_return_date: p.expectedReturnDate,
    notes: p.notes,
  };
}
