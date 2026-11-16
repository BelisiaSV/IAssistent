/**
 * The weekly exports of Voetbal Vlaanderen (CSV, ";"-separated, one header
 * row): calendar and results ("vvlresdown"), standings ("vvlcltdown") and
 * referee assignments ("vvldesdown"). They hold all divisions of all clubs;
 * the import keeps the divisions linked to a team.
 */
export type ExportKind = "results" | "standings" | "referees";

const HEADERS: Record<ExportKind, string[]> = {
  results: ["DIV", "DATE", "HOUR", "HOME", "AWAY", "RH", "RA", "STATUS", "MD", "REGNUMBERHOME", "REGNUMBERAWAY"],
  standings: ["DIV", "POS", "TEAM", "M", "W", "L", "D", "G+", "G-", "PTS", "PER"],
  referees: ["DIV", "DATE", "HOUR", "HOME", "AWAY", "STATUS", "REFEREE", "ASSISTANT-REFEREE1", "ASSISTANT-REFEREE2", "4THOFFICIAL", "TYPE"],
};

export interface MatchRow {
  division: string;
  date: string;
  kickoff: string | null;
  home: string;
  away: string;
  home_goals: number | null;
  away_goals: number | null;
  status: string | null;
  matchday: number | null;
  home_club: string | null;
  away_club: string | null;
}

export interface StandingRow {
  division: string;
  period: number;
  position: number;
  team: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  goals_for: number;
  goals_against: number;
  points: number;
}

export interface RefereeRow {
  division: string;
  date: string;
  kickoff: string | null;
  home: string;
  away: string;
  referee: string | null;
  assistant_1: string | null;
  assistant_2: string | null;
  fourth_official: string | null;
  match_type: string | null;
}

export type ParsedExport =
  | { kind: "results"; rows: MatchRow[] }
  | { kind: "standings"; rows: StandingRow[] }
  | { kind: "referees"; rows: RefereeRow[] };

/** Text of an export file: UTF-8 when valid, else Windows-1252 (the referee file). */
export function decodeExport(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function lines(text: string) {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(";").map((f) => f.trim()));
}

/** Which export a file is, from its header row. */
export function exportKind(text: string): ExportKind | null {
  const header = lines(text.slice(0, 500))[0]?.map((h) => h.toUpperCase()) ?? [];
  return (Object.keys(HEADERS) as ExportKind[]).find((k) => HEADERS[k].every((h, i) => header[i] === h)) ?? null;
}

const isoDate = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const time = (t: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null);
const int = (v: string) => (/^-?\d+$/.test(v) ? Number(v) : null);
const text = (v: string) => (v === "" ? null : v);

/**
 * Parses an export. Rows that cannot be read are skipped; a match that
 * appears twice (e.g. in a tournament) is kept once.
 */
export function parseExport(raw: string): ParsedExport | null {
  const kind = exportKind(raw);
  if (!kind) return null;
  const rows = lines(raw).slice(1).filter((r) => r.length >= HEADERS[kind].length);

  if (kind === "standings") {
    const out = new Map<string, StandingRow>();
    for (const r of rows) {
      const [division, pos, team, m, w, l, d, gf, ga, pts, per] = r as [string, string, string, string, string, string, string, string, string, string, string];
      const position = int(pos);
      if (!division || !team || position === null) continue;
      const row = { division, period: int(per) ?? 0, position, team, played: int(m) ?? 0, won: int(w) ?? 0, lost: int(l) ?? 0, drawn: int(d) ?? 0, goals_for: int(gf) ?? 0, goals_against: int(ga) ?? 0, points: int(pts) ?? 0 };
      out.set(`${division}|${row.period}|${team}`, row);
    }
    return { kind, rows: [...out.values()] };
  }

  const matches = new Map<string, MatchRow | RefereeRow>();
  for (const r of rows) {
    const [division, d, hour, home, away] = r as [string, string, string, string, string];
    const date = isoDate(d);
    if (!division || !date || !home || !away) continue;
    const key = `${division}|${date}|${home}|${away}`;
    if (kind === "results") {
      const [, , , , , rh, ra, status, md, regHome, regAway] = r as string[];
      const homeGoals = int(rh!);
      const awayGoals = int(ra!);
      matches.set(key, {
        division,
        date,
        kickoff: time(hour),
        home,
        away,
        home_goals: homeGoals !== null && awayGoals !== null ? homeGoals : null,
        away_goals: homeGoals !== null && awayGoals !== null ? awayGoals : null,
        status: text(status!),
        matchday: int(md!),
        home_club: text(regHome!),
        away_club: text(regAway!),
      });
    } else {
      const [, , , , , , referee, a1, a2, fourth, type] = r as string[];
      matches.set(key, {
        division,
        date,
        kickoff: time(hour),
        home,
        away,
        referee: text(referee!),
        assistant_1: text(a1!),
        assistant_2: text(a2!),
        fourth_official: text(fourth!),
        match_type: text(type!),
      });
    }
  }
  return kind === "results" ? { kind, rows: [...matches.values()] as MatchRow[] } : { kind, rows: [...matches.values()] as RefereeRow[] };
}

/** Every team in the exports with the divisions it plays in and its number of matches there (from the calendar). */
export function teamDivisions(exports: readonly ParsedExport[]) {
  const teams = new Map<string, Map<string, number>>();
  const add = (team: string, division: string, matches: number) => {
    const divisions = teams.get(team) ?? new Map<string, number>();
    divisions.set(division, (divisions.get(division) ?? 0) + matches);
    teams.set(team, divisions);
  };
  for (const e of exports) {
    const counts = e.kind === "results" ? 1 : 0;
    for (const row of e.rows) {
      if ("team" in row) add(row.team, row.division, 0);
      else {
        add(row.home, row.division, counts);
        add(row.away, row.division, counts);
      }
    }
  }
  return teams;
}

/** Only the rows of the given divisions (what is sent to the server). */
export function forDivisions<T extends { division: string }>(rows: readonly T[], divisions: ReadonlySet<string>): T[] {
  return rows.filter((r) => divisions.has(r.division));
}
