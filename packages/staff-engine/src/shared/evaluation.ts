import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.evaluation}`;

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  beoordeling: z.object({
    min: z.number().int(),
    max: z.number().int(),
    labels: z.record(z.string(), z.string().min(1).max(40)),
  }),
  aandachtspunten: z
    .array(
      z.object({
        code: z.string().regex(/^[a-z][a-z_]{0,39}$/),
        naam: z.string().min(1).max(60),
        uitleg: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(40),
});

/** Evaluation of trainings: rating scale and attention points (_gedeeld/evaluatie.json). */
export type EvaluationCatalog = z.infer<typeof schema>;

export function parseEvaluationCatalog(data: unknown): ParseResult<EvaluationCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const messages = duplicates(parsed.value.aandachtspunten.map((a) => a.code)).map((d) => `aandachtspunt "${d}" staat er twee keer`);
  if (parsed.value.beoordeling.min >= parsed.value.beoordeling.max) messages.push("beoordeling: min moet kleiner zijn dan max");
  return messages.length ? fail(FILE, messages) : parsed;
}

/**
 * Attention points that come back: how often each code was marked in the
 * evaluations, most frequent first (only codes marked at least `min` times).
 */
export function recurringPoints(
  evaluations: readonly { attention_points: readonly string[] }[],
  catalog: EvaluationCatalog,
  min = 2,
): { code: string; naam: string; aantal: number }[] {
  const counts = new Map<string, number>();
  for (const e of evaluations) for (const code of new Set(e.attention_points)) counts.set(code, (counts.get(code) ?? 0) + 1);
  return catalog.aandachtspunten
    .map((a) => ({ code: a.code, naam: a.naam, aantal: counts.get(a.code) ?? 0 }))
    .filter((a) => a.aantal >= min)
    .sort((a, b) => b.aantal - a.aantal);
}
