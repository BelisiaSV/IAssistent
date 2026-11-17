import type { BankExercise } from "@iassistent/staff-engine/content";

/** At most this many exercises of the bank go to the staff per question. */
export const BANK_FOR_STAFF = 15;

/** Columns of a bank exercise the staff and the coach pages need. */
export const BANK_COLUMNS = "number, title, kind, phase, target_group, tags, principles, content, media_kind, media_path";

export interface BankRow {
  number: string;
  title: string;
  kind: string;
  phase: string | null;
  target_group: string | null;
  tags: string[];
  principles: string[];
  content: unknown;
  media_kind?: string | null;
  /** Set when the file of the drawing or video is in the app. */
  media_path?: string | null;
}

const text = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** A bank exercise as the staff gets it (Dutch keys of the bank, no sources or notes). */
export function bankExercise(row: BankRow): BankExercise {
  const c = (row.content && typeof row.content === "object" ? row.content : {}) as Record<string, unknown>;
  return {
    nummer: row.number,
    titel: row.title,
    type: row.kind,
    spelfase: row.phase,
    doelgroep: row.target_group,
    hoofddoel: text(c.hoofddoel),
    subdoelen: list(c.subdoelen),
    principes: row.principles,
    aantal_spelers: text(c.aantal_spelers),
    duur: text(c.duur),
    veldafmeting: text(c.veldafmeting),
    belasting: text(c.belasting),
    organisatie: list(c.organisatie),
    verloop: list(c.verloop),
    regels: text(c.regels),
    coachingspunten: list(c.coachingspunten),
    makkelijker: text(c.makkelijker),
    moeilijker: text(c.moeilijker),
    materiaal: list(c.materiaal),
    tags: row.tags,
    beeld: row.media_path ? (row.media_kind === "video" ? "video" : "tekening") : null,
  };
}

/** Lower case without accents, split in words of three letters or more. */
export function words(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/** Two words match when one starts with the other's stem ("omschakeling" ~ "omschakelen"). */
const same = (a: string, b: string) => {
  const stem = Math.min(a.length, b.length, 6);
  return a.slice(0, stem) === b.slice(0, stem) && (a.startsWith(b) || b.startsWith(a) || stem >= 6);
};

/** How well an exercise fits the wanted words (0 = not at all). */
export function bankScore(row: BankRow, wanted: string[]): number {
  const c = (row.content && typeof row.content === "object" ? row.content : {}) as Record<string, unknown>;
  const fields: [string[], number][] = [
    [words(row.title), 3],
    [words([row.kind, row.phase ?? "", ...row.tags, ...row.principles].join(" ")), 2],
    [words([text(c.hoofddoel), ...list(c.subdoelen)].join(" ")), 1],
  ];
  return wanted.reduce((sum, w) => sum + Math.max(0, ...fields.map(([ws, weight]) => (ws.some((x) => same(x, w)) ? weight : 0))), 0);
}

/**
 * Ranks bank exercises against a question of the coach: words in the title
 * count most, then type, phase, tags and principles, then the goals.
 * Without a question (or without matches) the order of the bank stays.
 */
export function rankBank(rows: BankRow[], query: string, limit = BANK_FOR_STAFF): BankRow[] {
  const wanted = [...new Set(words(query))];
  if (!wanted.length) return rows.slice(0, limit);
  const scored = rows.map((row, index) => ({ row, index, score: bankScore(row, wanted) }));
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((s) => s.row);
}
