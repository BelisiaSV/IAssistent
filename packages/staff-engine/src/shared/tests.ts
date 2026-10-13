import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { daysBetween } from "./matchdays";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.tests}`;

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  testen: z
    .array(
      z
        .object({
          code: z.string().regex(/^[a-z][a-z0-9_-]*$/),
          naam: z.string().min(1),
          resultaat: z.string().min(1),
          eenheid: z.string().min(1),
          min: z.number(),
          max: z.number(),
          interval_weken: z.int().min(1),
          uitleg: z.string().min(1),
        })
        .refine((t) => t.min < t.max, "min moet kleiner zijn dan max"),
    )
    .min(1),
});

export type TestCatalog = z.infer<typeof schema>;
export type FitnessTest = TestCatalog["testen"][number];

export function parseTests(data: unknown): ParseResult<TestCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const errors = duplicates(parsed.value.testen.map((t) => t.code)).map((c) => `test "${c}" komt dubbel voor`);
  return errors.length ? fail(FILE, errors) : parsed;
}

/** Is a new test due in the week starting on `weekStart`? */
export function testDue(lastTestDate: string | null, weekStart: string, intervalWeeks: number): boolean {
  if (!lastTestDate) return true;
  return daysBetween(lastTestDate, weekStart) + 6 >= intervalWeeks * 7;
}
