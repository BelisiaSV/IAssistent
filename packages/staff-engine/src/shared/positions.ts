import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.positions}`;

export const POSITION_CODE_PATTERN = /^[A-Z][A-Z0-9]{0,5}$/;

const schema = z.object({
  versie: z.string().min(1),
  linies: z.array(z.object({ id: z.string().min(1), naam: z.string().min(1) })).min(1),
  posities: z
    .array(
      z.object({
        code: z.string().regex(POSITION_CODE_PATTERN, "code: hoofdletters/cijfers, max. 6 tekens"),
        naam: z.string().min(1),
        linie: z.string().min(1),
      }),
    )
    .min(1),
});

export type PositionCatalog = z.infer<typeof schema>;
export type Position = PositionCatalog["posities"][number];
export type PositionLine = PositionCatalog["linies"][number];

/** Validates the content of _gedeeld/posities.json. */
export function parsePositions(data: unknown): ParseResult<PositionCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const catalog = parsed.value;

  const lineIds = new Set(catalog.linies.map((l) => l.id));
  const errors = [
    ...duplicates(catalog.linies.map((l) => l.id)).map((id) => `linie "${id}" komt dubbel voor`),
    ...duplicates(catalog.posities.map((p) => p.code)).map((c) => `positie "${c}" komt dubbel voor`),
    ...catalog.posities
      .filter((p) => !lineIds.has(p.linie))
      .map((p) => `positie "${p.code}" verwijst naar onbekende linie "${p.linie}"`),
  ];
  return errors.length ? fail(FILE, errors) : parsed;
}
