import { z } from "zod";

/** Club documents: the types the bucket accepts and its size limit. */
export const DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
];
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

const part = z.object({
  fase: z.string(),
  naam: z.string(),
  doel: z.string().nullish(),
  organisatie: z.string().nullish(),
  spelers: z.string().nullish(),
  coachingspunten: z.array(z.string()).default([]),
  duur_min: z.number().nullish(),
  reeksen: z.number().nullish(),
  werk_per_reeks: z.string().nullish(),
  rust_tussen_reeksen: z.string().nullish(),
  intensiteit: z.string().nullish(),
  rpe: z.number().nullish(),
  oefening_id: z.string().nullish(),
  bank_nummer: z.string().nullish(),
});

const day = z.object({
  datum: z.string(),
  md: z.string().nullish(),
  soort: z.literal("training"),
  titel: z.string(),
  doel: z.string().nullish(),
  totale_duur_min: z.number().nullish(),
  belasting: z.string().nullish(),
  onderdelen: z.array(part),
});

export type SharedTraining = z.infer<typeof day>;

/**
 * The training of `date` from the Assistant Coach's week document, as shared
 * with the club: only the training itself (no individual programs or remarks,
 * which may name players).
 */
export function trainingDaySnapshot(output: unknown, date: string): SharedTraining | null {
  const days = (output as { dagen?: unknown[] } | null)?.dagen ?? [];
  for (const raw of days) {
    const parsed = day.safeParse(raw);
    if (parsed.success && parsed.data.datum === date) {
      // Own exercises stay with the coach: keep the content, not the link.
      return { ...parsed.data, onderdelen: parsed.data.onderdelen.map((p) => ({ ...p, oefening_id: null })) };
    }
  }
  return null;
}

/** Training days of a week document (for the share form). */
export function trainingDays(output: unknown): { datum: string; titel: string }[] {
  const days = (output as { dagen?: unknown[] } | null)?.dagen ?? [];
  return days.flatMap((raw) => {
    const parsed = day.safeParse(raw);
    return parsed.success ? [{ datum: parsed.data.datum, titel: parsed.data.titel }] : [];
  });
}

export function readSharedTraining(content: unknown): SharedTraining | null {
  return day.safeParse(content).data ?? null;
}
