import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.exercises.errors;

const optionalInt = (min: number, max: number, message: string) =>
  z.union([z.literal("").transform(() => null), z.coerce.number().int(message).min(min, message).max(max, message)]);
const optionalDecimal = (min: number, max: number, message: string) =>
  z.union([
    z.literal("").transform(() => null),
    z
      .string()
      .transform((v) => Number(v.replace(",", ".")))
      .pipe(z.number(message).min(min, message).max(max, message))
      .transform((v) => Math.round(v * 10) / 10),
  ]);
const lines = (max: number) =>
  z
    .string()
    .max(6000, e.tooLong)
    .transform((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(300, e.tooLong)).max(max, e.tooMany));

/** Set piece types: the codes the Tactical Coach uses (labels in messages). */
export const SET_PIECE_TYPES = Object.keys(messages.matchPlan.setPieceKind) as [string, ...string[]];

/** "Nemer – linksvoetig" → { rol: "Nemer", vereiste: "linksvoetig" } (also "-" or ":"). */
export function parseRole(line: string): { rol: string; vereiste: string | null } {
  const [rol, ...rest] = line.split(/\s+[–-]\s+|:\s*/);
  const vereiste = rest.join(" – ").trim();
  return { rol: rol!.trim(), vereiste: vereiste || null };
}

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"] as const;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** The exercise form (all fields as strings, lists as one item per line). */
export const exerciseFormSchema = z
  .object({
    kind: z.enum(["exercise", "set_piece"]),
    setPieceType: z.union([z.literal("").transform(() => null), z.enum(SET_PIECE_TYPES, e.setPieceType)]),
    signal: z
      .string()
      .trim()
      .max(80, e.tooLong)
      .transform((v) => (v === "" ? null : v)),
    roles: z
      .string()
      .max(3000, e.tooLong)
      .transform((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
      .pipe(z.array(z.string().max(80, e.roles)).max(15, e.roles))
      .transform((lines) => lines.map(parseRole)),
    title: z.string().trim().min(1, e.title).max(120, e.title),
    phase: z.union([z.literal("").transform(() => null), z.enum(["opwarming", "kern", "afsluiting"])]),
    labels: z
      .string()
      .max(600, e.tooLong)
      .transform((v) => [...new Set(v.split(",").map((l) => l.trim().toLowerCase()).filter(Boolean))])
      .pipe(z.array(z.string().max(40, e.tooLong)).max(20, e.tooMany)),
    minPlayers: optionalInt(1, 40, e.players),
    maxPlayers: optionalInt(1, 40, e.players),
    duration: optionalInt(1, 120, e.duration),
    sets: optionalInt(1, 20, e.load),
    workMin: optionalDecimal(0.5, 60, e.load),
    restMin: optionalDecimal(0, 30, e.load),
    intensity: z.union([z.literal("").transform(() => null), z.enum(["laag", "matig", "hoog", "maximaal"])]),
    rpe: optionalInt(1, 10, e.load),
    useInPlanning: z.boolean(),
    organisation: z
      .string()
      .trim()
      .max(2000, e.tooLong)
      .transform((v) => (v === "" ? null : v)),
    course: lines(30),
    coaching: lines(30),
    variations: lines(30),
  })
  .refine((v) => v.minPlayers === null || v.maxPlayers === null || v.minPlayers <= v.maxPlayers, { message: e.players, path: ["minPlayers"] })
  .refine((v) => v.kind === "exercise" || v.setPieceType !== null, { message: e.setPieceType, path: ["setPieceType"] });
export type ExerciseForm = z.output<typeof exerciseFormSchema>;

/** File extension for an allowed video type. */
export function videoExtension(type: string): string | null {
  return ({ "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv" } as Record<string, string>)[type] ?? null;
}
