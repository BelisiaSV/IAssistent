import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.matchDays}`;

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  dagen: z
    .array(
      z
        .object({
          code: z.string().min(1).max(10),
          naam: z.string().min(1),
          uitleg: z.string().min(1),
          dagen_tot_wedstrijd: z.int().min(0).max(14).optional(),
          dagen_na_wedstrijd: z.int().min(1).max(14).optional(),
        })
        .refine(
          (d) => (d.dagen_tot_wedstrijd === undefined) !== (d.dagen_na_wedstrijd === undefined),
          "geef precies één van dagen_tot_wedstrijd of dagen_na_wedstrijd",
        ),
    )
    .min(1),
});

export type MatchDayCatalog = z.infer<typeof schema>;
export type MatchDay = MatchDayCatalog["dagen"][number];

export function parseMatchDays(data: unknown): ParseResult<MatchDayCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const errors = duplicates(parsed.value.dagen.map((d) => d.code)).map(
    (c) => `label "${c}" komt dubbel voor`,
  );
  return errors.length ? fail(FILE, errors) : parsed;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from `from` to `to` (ISO dates, YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) throw new Error(`invalid ISO date: ${from} / ${to}`);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * The label for `date` given the match dates around it: the first entry in
 * the catalog (its order is the priority) whose distance to a match fits.
 */
export function matchDayFor(
  date: string,
  matchDates: readonly string[],
  catalog: MatchDayCatalog,
): MatchDay | null {
  for (const day of catalog.dagen) {
    for (const match of matchDates) {
      const until = daysBetween(date, match);
      if (day.dagen_tot_wedstrijd !== undefined && until === day.dagen_tot_wedstrijd) return day;
      if (day.dagen_na_wedstrijd !== undefined && -until === day.dagen_na_wedstrijd) return day;
    }
  }
  return null;
}
