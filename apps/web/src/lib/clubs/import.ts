import {
  CLUB_ROLES,
  CLUB_ROLES_WITH_LICENSE,
  type ClubRole,
  TEAM_STAFF_ROLES,
  type TeamStaffRole,
} from "@iassistent/db";

import { messages } from "@/lib/messages";
import { cellText } from "@/lib/players/import";
import { AGE_CATEGORIES, type AgeCategory } from "@/lib/teams/age-categories";

const m = messages.clubAdmin.excel;
const e = m.errors;

/** Columns per sheet, in order (headers in messages). */
export const CLUB_COLUMNS = [
  "name",
  "number",
  "address",
  "contactName",
  "contactEmail",
  "contactPhone",
  "primaryColor",
  "secondaryColor",
] as const;
export const TEAM_COLUMNS = [
  "teamName",
  "ageCategory",
  "season",
  "federationTeam",
  "divisions",
] as const;
export const STAFF_COLUMNS = ["staffName", "role", "team", "teamRole"] as const;
type Column =
  | (typeof CLUB_COLUMNS)[number]
  | (typeof TEAM_COLUMNS)[number]
  | (typeof STAFF_COLUMNS)[number];

export const MAX_TEAMS = 100;
export const MAX_STAFF = 300;

export interface ClubSheets {
  club: unknown[][];
  teams: unknown[][];
  staff: unknown[][];
}

export interface ClubDetails {
  name: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface TeamRow {
  line: number;
  name: string;
  ageCategory: AgeCategory | null;
  season: string;
  federationTeam: string;
  divisions: string[];
  errors: string[];
}

export interface StaffRow {
  line: number;
  name: string;
  role: ClubRole | null;
  team: string;
  teamRole: TeamStaffRole | null;
  errors: string[];
}

export interface ClubImport {
  club: ClubDetails;
  clubErrors: string[];
  teams: TeamRow[];
  staff: StaffRow[];
}

const normal = (s: string) => s.trim().toLowerCase();
const HEX = /^#[0-9A-Fa-f]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A label from the lists or the code itself → the code; "" when empty, null when unknown. */
function fromLabel<T extends string>(
  text: string,
  codes: readonly T[],
  labels: Record<string, string>,
): T | "" | null {
  if (!text.trim()) return "";
  const t = normal(text);
  return (
    codes.find((c) => normal(c) === t || normal(labels[c] ?? "") === t) ?? null
  );
}

/** Rows of a sheet as objects by column, with the sheet's row number; empty rows are skipped. */
function table<C extends Column>(
  cells: unknown[][],
  columns: readonly C[],
  sheet: string,
): { rows: { line: number; values: Record<C, string> }[] } | { error: string } {
  const header = (cells[0] ?? []).map((c) => normal(cellText(c)));
  const index = {} as Record<C, number>;
  for (const col of columns) {
    const i = header.indexOf(normal(m.columns[col]));
    if (i < 0) return { error: e.missingColumn(sheet, m.columns[col]) };
    index[col] = i;
  }
  const rows: { line: number; values: Record<C, string> }[] = [];
  cells.slice(1).forEach((row, i) => {
    const values = {} as Record<C, string>;
    for (const col of columns) values[col] = cellText(row?.[index[col]]);
    if (columns.some((col) => values[col] !== ""))
      rows.push({ line: i + 2, values });
  });
  return { rows };
}

/**
 * Reads the three sheets the club filled in and checks every row.
 * `existingTeams` are the names of the club's active teams: staff may be put on
 * those even when they are not on the Teams sheet.
 */
export function parseClubImport(
  sheets: ClubSheets,
  existingTeams: string[] = [],
): ClubImport | { error: string } {
  const clubTable = table(sheets.club, CLUB_COLUMNS, m.sheets.club);
  if ("error" in clubTable) return clubTable;
  const teamTable = table(sheets.teams, TEAM_COLUMNS, m.sheets.teams);
  if ("error" in teamTable) return teamTable;
  const staffTable = table(sheets.staff, STAFF_COLUMNS, m.sheets.staff);
  if ("error" in staffTable) return staffTable;
  if (teamTable.rows.length > MAX_TEAMS)
    return { error: `${m.sheets.teams}: ${e.tooManyRows(MAX_TEAMS)}` };
  if (staffTable.rows.length > MAX_STAFF)
    return { error: `${m.sheets.staff}: ${e.tooManyRows(MAX_STAFF)}` };

  // Club: the first filled row.
  const c = clubTable.rows[0]?.values;
  const club: ClubDetails = {
    name: c?.name ?? "",
    address: c?.address ?? "",
    contactName: c?.contactName ?? "",
    contactEmail: c?.contactEmail ?? "",
    contactPhone: c?.contactPhone ?? "",
    primaryColor: (c?.primaryColor ?? "").toUpperCase(),
    secondaryColor: (c?.secondaryColor ?? "").toUpperCase(),
  };
  const clubErrors: string[] = [];
  const max = (value: string, n: number, col: Column) => {
    if (value.length > n) clubErrors.push(e.tooLong(m.columns[col]));
  };
  max(club.name, 120, "name");
  max(club.address, 200, "address");
  max(club.contactName, 120, "contactName");
  max(club.contactEmail, 200, "contactEmail");
  max(club.contactPhone, 40, "contactPhone");
  if (club.contactEmail && !EMAIL.test(club.contactEmail))
    clubErrors.push(e.email);
  if (club.primaryColor && !HEX.test(club.primaryColor))
    clubErrors.push(e.color(m.columns.primaryColor));
  if (club.secondaryColor && !HEX.test(club.secondaryColor))
    clubErrors.push(e.color(m.columns.secondaryColor));

  // Teams
  const seen = new Set<string>();
  const teams: TeamRow[] = teamTable.rows.map(({ line, values }) => {
    const errors: string[] = [];
    const name = values.teamName;
    if (!name) errors.push(e.required(m.columns.teamName));
    else if (name.length > 120) errors.push(e.tooLong(m.columns.teamName));
    else if (seen.has(normal(name))) errors.push(e.duplicateTeam);
    seen.add(normal(name));
    const category = fromLabel(
      values.ageCategory,
      AGE_CATEGORIES,
      messages.ageCategories,
    );
    if (category === null) errors.push(e.ageCategory);
    if (values.season.length > 20) errors.push(e.tooLong(m.columns.season));
    if (values.federationTeam.length > 120)
      errors.push(e.tooLong(m.columns.federationTeam));
    const divisions = values.divisions
      .split(/[,;]/)
      .map((d) => d.trim())
      .filter(Boolean);
    if (divisions.some((d) => d.length > 20) || divisions.length > 10)
      errors.push(e.tooLong(m.columns.divisions));
    return {
      line,
      name,
      ageCategory: category || null,
      season: values.season,
      federationTeam: values.federationTeam,
      divisions,
      errors,
    };
  });

  // Staff
  const known = new Set([
    ...teams.map((t) => normal(t.name)),
    ...existingTeams.map(normal),
  ]);
  const staff: StaffRow[] = staffTable.rows.map(({ line, values }) => {
    const errors: string[] = [];
    if (!values.staffName) errors.push(e.required(m.columns.staffName));
    else if (values.staffName.length > 120)
      errors.push(e.tooLong(m.columns.staffName));
    const role = fromLabel(values.role, CLUB_ROLES, messages.clubAdmin.roles);
    if (role === "") errors.push(e.required(m.columns.role));
    else if (role === null) errors.push(e.role);
    const teamRole = fromLabel(
      values.teamRole,
      TEAM_STAFF_ROLES,
      messages.clubAdmin.teamRoles,
    );
    if (teamRole === null) errors.push(e.teamRole);
    if (values.team && !known.has(normal(values.team)))
      errors.push(e.teamUnknown);
    if (teamRole && !values.team) errors.push(e.teamRoleWithoutTeam);
    if (values.team && !teamRole) errors.push(e.required(m.columns.teamRole));
    if (role && teamRole && !teamRoleFits(role, teamRole))
      errors.push(e.teamRoleMismatch);
    return {
      line,
      name: values.staffName,
      role: role || null,
      team: values.team,
      teamRole: teamRole || null,
      errors,
    };
  });

  return { club, clubErrors, teams, staff };
}

/** Head and assistant coaches are coaches; coordinators are team coordinators. */
export function teamRoleFits(role: ClubRole, teamRole: TeamStaffRole): boolean {
  if (teamRole === "coordinator") return role === "team_coordinator";
  return role === "coach" || role === "assistant_coach";
}

/** Licences the staff on the sheet will use. */
export function seatsNeeded(staff: Pick<StaffRow, "role">[]): number {
  return staff.filter((s) => s.role && CLUB_ROLES_WITH_LICENSE.includes(s.role))
    .length;
}

export function hasErrors(data: ClubImport): boolean {
  return (
    data.clubErrors.length > 0 ||
    data.teams.some((t) => t.errors.length) ||
    data.staff.some((s) => s.errors.length)
  );
}

/** What admin_import_club expects. */
export function toImportPayload(data: ClubImport) {
  return {
    club: {
      name: data.club.name,
      address: data.club.address,
      contact_name: data.club.contactName,
      contact_email: data.club.contactEmail,
      contact_phone: data.club.contactPhone,
      primary_color: data.club.primaryColor,
      secondary_color: data.club.secondaryColor,
    },
    teams: data.teams.map((t) => ({
      name: t.name,
      age_category: t.ageCategory ?? "",
      season: t.season,
      federation_team: t.federationTeam,
      divisions: t.divisions,
    })),
    staff: data.staff.map((s) => ({
      name: s.name,
      role: s.role,
      team: s.teamRole ? s.team : "",
      team_role: s.teamRole && s.team ? s.teamRole : "",
    })),
  };
}
