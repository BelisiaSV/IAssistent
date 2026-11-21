import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.quality}`;
const code = z.string().regex(/^[a-z][a-z_]*$/).max(40);

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  /** The role that checks the week (task taken/kwaliteitscontrole). */
  rol: z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/),
  schaal: z.object({
    min: z.number().int(),
    max: z.number().int(),
    labels: z.record(z.string(), z.string().min(1).max(40)),
  }),
  /** Verdicts from the average score, highest threshold first. */
  oordelen: z
    .array(z.object({ code, label: z.string().min(1).max(40), vanaf: z.number() }))
    .min(1)
    .max(6),
  criteria: z
    .array(z.object({ code, naam: z.string().min(1).max(60), controle: z.string().min(1).max(600) }))
    .min(1)
    .max(12),
});

/** Training Quality Engine: criteria, scale and verdicts (_gedeeld/kwaliteit.json). */
export type QualityCriteria = z.infer<typeof schema>;

export function parseQualityCriteria(data: unknown): ParseResult<QualityCriteria> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const value = parsed.value;
  const messages: string[] = [];
  for (const dup of duplicates(value.criteria.map((c) => c.code))) messages.push(`criterium "${dup}" staat er twee keer`);
  if (value.schaal.min >= value.schaal.max) messages.push("schaal: min moet kleiner zijn dan max");
  const thresholds = value.oordelen.map((o) => o.vanaf);
  if (thresholds.some((t, i) => i > 0 && t >= thresholds[i - 1]!)) messages.push("oordelen: van hoog naar laag ordenen");
  if (thresholds[thresholds.length - 1]! > value.schaal.min) messages.push("oordelen: het laatste oordeel moet vanaf de laagste score gelden");
  return messages.length ? fail(FILE, messages) : parsed;
}

/** The verdict for an average score. */
export function qualityVerdict(criteria: QualityCriteria, average: number) {
  return criteria.oordelen.find((o) => average >= o.vanaf) ?? criteria.oordelen[criteria.oordelen.length - 1]!;
}
