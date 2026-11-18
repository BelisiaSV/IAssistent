import { z } from "zod";

/**
 * Reads the backup of the admin's exercise database (a JSON list of exercises
 * with Dutch keys, e.g. `nummer`, `titel`, `organisatie`). The exercise itself
 * is content: it is kept as it is in `content`; only the fields to search and
 * filter on get their own columns.
 */

const MAX_EXERCISES = 500;

const text = (max: number) =>
  z
    .preprocess(
      (v) => (v == null ? "" : typeof v === "number" ? String(v) : v),
      z.string().max(max),
    )
    .transform((s) => s.trim());
const list = (maxItems: number, maxLength: number) =>
  z
    .preprocess(
      (v) => (v == null ? [] : v),
      z.array(text(maxLength)).max(maxItems),
    )
    .transform((items) => items.filter((i) => i.length > 0));
const optional = (max: number) =>
  text(max).transform((s) => (s.length ? s : null));

const sourceSchema = z.object({
  id: optional(80),
  nummer: text(20).pipe(z.string().regex(/^[A-Za-z]{1,10}-[0-9]{1,6}$/)),
  titel: text(200).pipe(z.string().min(1)),
  type: text(60).pipe(z.string().min(1)),
  spelfase: optional(60),
  doelgroep: optional(200),
  hoofddoel: text(2000),
  subdoelen: list(30, 500),
  principes: list(30, 200),
  aantal_spelers: text(200),
  duur: text(100),
  veldafmeting: text(200),
  belasting: text(60),
  belasting_toelichting: text(1000),
  organisatie: list(40, 1000),
  verloop: list(40, 1000),
  regels: text(2000),
  coachingspunten: list(40, 1000),
  makkelijker: text(1000),
  moeilijker: text(1000),
  materiaal: list(40, 300),
  zones: z.preprocess(
    (v) => (v == null ? [] : v),
    z.array(z.number().int().min(0).max(100)).max(100),
  ),
  tags: list(50, 60),
  bron: text(500),
  notities: z.preprocess(
    (v) => (v == null ? [] : v),
    z
      .array(
        z.object({
          datum: optional(40),
          soort: optional(40),
          tekst: text(2000),
        }),
      )
      .max(50),
  ),
  diagram: optional(120),
  /** Path of the drawing or video in the export (e.g. "media/OEF-007.mp4"). */
  media_bestand: optional(300),
  diagram_type: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(["image", "video"]).nullable().optional(),
  ),
  versie: z.number().int().min(0).max(100000).nullable().optional(),
  aangemaakt: optional(40),
  gewijzigd: optional(40),
});

export type BankSource = z.infer<typeof sourceSchema>;

/** One exercise as it goes to `admin_import_bank_exercises`. */
export interface BankExercise {
  number: string;
  source_id: string | null;
  title: string;
  kind: string;
  phase: string | null;
  target_group: string | null;
  tags: string[];
  principles: string[];
  media_kind: "image" | "video" | null;
  media_key: string | null;
  content: Omit<BankSource, "id" | "nummer" | "titel" | "diagram" | "diagram_type" | "media_bestand">;
  /** Path of the drawing or video in a zip export, if any (not stored). */
  media_file: string | null;
}

export interface BankIssue {
  /** 1-based position in the file. */
  position: number;
  label: string;
  /** Field that is wrong, or "nummer" for a duplicate number. */
  field: string;
  duplicate?: boolean;
}

export interface BankParseResult {
  exercises: BankExercise[];
  issues: BankIssue[];
  /** Numbers of exercises with an open question mark ("regels: ?"), to check before approving. */
  uncertain: string[];
}

/** A question mark standing on its own: "?" or "… uitspelen ?". Not a coaching question like "Waar is de vrije man?". */
const OPEN_QUESTION = /(^|\s)\?(\s|$)/;

export function hasOpenQuestion(value: unknown): boolean {
  if (typeof value === "string") return OPEN_QUESTION.test(value);
  if (Array.isArray(value)) return value.some(hasOpenQuestion);
  if (value && typeof value === "object")
    return Object.values(value).some(hasOpenQuestion);
  return false;
}

/** The list of exercises in a backup: the file itself, or the first list in it. */
function exerciseList(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") {
    const found = Object.values(input).find(Array.isArray);
    if (found) return found;
  }
  return null;
}

export function parseBank(input: unknown): BankParseResult | null {
  const items = exerciseList(input);
  if (!items || items.length === 0 || items.length > MAX_EXERCISES) return null;
  const result: BankParseResult = { exercises: [], issues: [], uncertain: [] };
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const raw =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const label =
      [raw.nummer, raw.titel]
        .filter((v) => typeof v === "string" && v)
        .join(" ") || `#${index + 1}`;
    const parsed = sourceSchema.safeParse(item);
    if (!parsed.success) {
      result.issues.push({
        position: index + 1,
        label,
        field: String(parsed.error.issues[0]?.path[0] ?? ""),
      });
      return;
    }
    const { id, nummer, titel, diagram, diagram_type, media_bestand, ...content } = parsed.data;
    // The code of the picture: the code of the source, else the file name in the export.
    const fileKey = media_bestand ? (media_bestand.split("/").pop() ?? "").replace(/\.[^.]+$/, "") : null;
    const mediaKey = diagram ?? (fileKey || null);
    const fileKind = media_bestand && /\.(mp4|webm|mov)$/i.test(media_bestand) ? "video" : media_bestand ? "image" : null;
    const number = nummer.toUpperCase();
    if (seen.has(number)) {
      result.issues.push({
        position: index + 1,
        label,
        field: "nummer",
        duplicate: true,
      });
      return;
    }
    seen.add(number);
    result.exercises.push({
      number,
      source_id: id,
      title: titel,
      kind: content.type,
      phase: content.spelfase,
      target_group: content.doelgroep,
      tags: content.tags,
      principles: content.principes,
      media_kind: mediaKey ? (diagram_type ?? fileKind) : null,
      media_key: mediaKey,
      content,
      media_file: media_bestand,
    });
    if (hasOpenQuestion(content)) result.uncertain.push(number);
  });
  return result;
}

/** Same check on the uploaded text, in the browser and again on the server. */
export function parseBankText(textValue: string): BankParseResult | null {
  try {
    return parseBank(JSON.parse(textValue));
  } catch {
    return null;
  }
}

export const BANK_TEXT_MAX = 2_500_000;
