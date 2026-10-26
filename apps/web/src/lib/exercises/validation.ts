import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.exercises.errors;

const optionalInt = (min: number, max: number, message: string) =>
  z.union([z.literal("").transform(() => null), z.coerce.number().int(message).min(min, message).max(max, message)]);
const lines = (max: number) =>
  z
    .string()
    .max(6000, e.tooLong)
    .transform((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(300, e.tooLong)).max(max, e.tooMany));

export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"] as const;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/** The exercise form (all fields as strings, lists as one item per line). */
export const exerciseFormSchema = z
  .object({
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
    organisation: z
      .string()
      .trim()
      .max(2000, e.tooLong)
      .transform((v) => (v === "" ? null : v)),
    course: lines(30),
    coaching: lines(30),
    variations: lines(30),
  })
  .refine((v) => v.minPlayers === null || v.maxPlayers === null || v.minPlayers <= v.maxPlayers, { message: e.players, path: ["minPlayers"] });
export type ExerciseForm = z.output<typeof exerciseFormSchema>;

/** File extension for an allowed video type. */
export function videoExtension(type: string): string | null {
  return ({ "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-matroska": "mkv" } as Record<string, string>)[type] ?? null;
}
