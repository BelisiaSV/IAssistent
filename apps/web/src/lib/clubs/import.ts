import {
  CLUB_PERSON_ROLES,
  CLUB_PERSON_TEAM_ROLES,
  type ClubPersonRole,
  type ClubRole,
  type TeamStaffRole,
} from "@iassistent/db";

import { messages } from "@/lib/messages";
import { cellText } from "@/lib/players/import";
import { AGE_CATEGORIES, type AgeCategory } from "@/lib/teams/age-categories";

const m = messages.clubPeople.file;
const e = m.errors;

/** Columns per sheet, in order (headers in messages). */
export const TEAM_COLUMNS = ["teamName", "category", "federationTeam"] as const;
export const PEOPLE_COLUMNS = ["name", "email", "role", "team"] as const;
type Column = (typeof TEAM_COLUMNS)[number] | (typeof PEOPLE_COLUMNS)[number];

export const MAX_TEAMS = 100;
export const MAX_PEOPLE = 300;

export interface ClubSheets {
  teams: unknown[][];
  people: unknown[][];
}

export interface TeamRow {
  line: number;
  name: string;
  category: AgeCategory | null;
  federationTeam: string;
  errors: string[];
}

export interface PersonRow {
  line: number;
  name: string;
  email: string;
  role: ClubPersonRole | null;
  team: string;
  errors: string[];
}

export interface ClubFile {
  teams: TeamRow[];
  people: PersonRow[];
}

const normal = (s: string) => s.trim().toLowerCase();
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Reads the two sheets of the club file and checks every row.
 * `existingTeams`: the club's active teams (people may be put on those even
 * when they are not on the Teams sheet). `federationTeams`: the club's teams in
 * the competition export.
 */
export function parseClubFile(
  sheets: ClubSheets,
  existingTeams: string[] = [],
  federationTeams: string[] = [],
): ClubFile | { error: string } {
  const teamTable = table(sheets.teams, TEAM_COLUMNS, m.sheets.teams);
  if ("error" in teamTable) return teamTable;
  const peopleTable = table(sheets.people, PEOPLE_COLUMNS, m.sheets.people);
  if ("error" in peopleTable) return peopleTable;
  if (teamTable.rows.length > MAX_TEAMS)
    return { error: `${m.sheets.teams}: ${e.tooManyRows(MAX_TEAMS)}` };
  if (peopleTable.rows.length > MAX_PEOPLE)
    return { error: `${m.sheets.people}: ${e.tooManyRows(MAX_PEOPLE)}` };

  const federation = new Map(federationTeams.map((f) => [normal(f), f]));
  const seen = new Set<string>();
  const teams: TeamRow[] = teamTable.rows.map(({ line, values }) => {
    const errors: string[] = [];
    const name = values.teamName;
    if (!name) errors.push(e.required(m.columns.teamName));
    else if (name.length > 120) errors.push(e.tooLong(m.columns.teamName));
    else if (seen.has(normal(name))) errors.push(e.duplicateTeam);
    seen.add(normal(name));
    const category = fromLabel(
      values.category,
      AGE_CATEGORIES,
      messages.ageCategories,
    );
    if (category === null) errors.push(e.category);
    let federationTeam = values.federationTeam;
    if (federationTeam) {
      const found = federation.get(normal(federationTeam));
      if (found) federationTeam = found;
      else errors.push(e.federationTeam);
    }
    return { line, name, category: category || null, federationTeam, errors };
  });

  const known = new Set([
    ...teams.map((t) => normal(t.name)),
    ...existingTeams.map(normal),
  ]);
  const people: PersonRow[] = peopleTable.rows.map(({ line, values }) => {
    const errors: string[] = [];
    if (values.name.length > 120) errors.push(e.tooLong(m.columns.name));
    const email = values.email.trim().toLowerCase();
    if (!email) errors.push(e.required(m.columns.email));
    else if (!EMAIL.test(email) || email.length > 200) errors.push(e.email);
    const role = fromLabel(
      values.role,
      CLUB_PERSON_ROLES,
      messages.clubPeople.roles,
    );
    if (role === "") errors.push(e.required(m.columns.role));
    else if (role === null) errors.push(e.role);
    if (values.team) {
      if (!known.has(normal(values.team))) errors.push(e.teamUnknown);
      else if (role && !CLUB_PERSON_TEAM_ROLES.includes(role))
        errors.push(e.roleWithoutTeam);
    }
    return {
      line,
      name: values.name,
      email,
      role: role || null,
      team: values.team,
      errors,
    };
  });

  return { teams, people };
}

/** Head and assistant coaches are coaches; coordinators are team coordinators. */
export function teamRoleFits(role: ClubRole, teamRole: TeamStaffRole): boolean {
  if (teamRole === "coordinator") return role === "team_coordinator";
  return role === "coach" || role === "assistant_coach";
}

/** Person roles that use a licence (technical director and trainers). */
const LICENSED: readonly ClubPersonRole[] = [
  "technical_director",
  "head_coach",
  "assistant_coach",
];

/** New licences the file needs: one per e-mail with a licensed role, leaving out who has one already. */
export function seatsNeeded(
  people: Pick<PersonRow, "email" | "role">[],
  licensed: Iterable<string> = [],
): number {
  const have = new Set([...licensed].map(normal));
  return new Set(
    people
      .filter((p) => p.role && LICENSED.includes(p.role) && !have.has(p.email))
      .map((p) => p.email),
  ).size;
}

export function hasErrors(data: ClubFile): boolean {
  return (
    data.teams.some((t) => t.errors.length) ||
    data.people.some((p) => p.errors.length)
  );
}

/** What import_club_file expects. */
export function toFilePayload(data: ClubFile) {
  return {
    teams: data.teams.map((t) => ({
      name: t.name,
      age_category: t.category ?? "",
      federation_team: t.federationTeam,
    })),
    people: data.people.map((p) => ({
      name: p.name,
      email: p.email,
      role: p.role,
      team:
        p.role && CLUB_PERSON_TEAM_ROLES.includes(p.role) ? p.team : "",
    })),
  };
}
