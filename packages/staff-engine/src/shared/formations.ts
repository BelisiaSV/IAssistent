import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";
import type { PositionCatalog } from "./positions";

const FILE = `${SHARED_DIR}/${SHARED_FILES.formations}`;

const coordinate = z.number().min(0).max(100);

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  formaties: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        naam: z.string().min(1),
        posten: z
          .array(
            z.object({
              id: z.string().regex(/^[A-Z][A-Z0-9]{0,5}$/, "post-id: hoofdletters/cijfers, max. 6 tekens"),
              positie: z.string().min(1),
              x: coordinate,
              y: coordinate,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type FormationCatalog = z.infer<typeof schema>;
export type Formation = FormationCatalog["formaties"][number];
export type FormationSlot = Formation["posten"][number];

/** Validates _gedeeld/formaties.json against the position catalog. */
export function parseFormations(
  data: unknown,
  positions: PositionCatalog | null,
): ParseResult<FormationCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const catalog = parsed.value;

  const codes = positions ? new Set(positions.posities.map((p) => p.code)) : null;
  const errors = duplicates(catalog.formaties.map((f) => f.code)).map(
    (c) => `formatie "${c}" komt dubbel voor`,
  );
  for (const formation of catalog.formaties) {
    for (const id of duplicates(formation.posten.map((s) => s.id))) {
      errors.push(`formatie "${formation.code}": post "${id}" komt dubbel voor`);
    }
    for (const slot of formation.posten) {
      if (codes && !codes.has(slot.positie)) {
        errors.push(
          `formatie "${formation.code}": post "${slot.id}" verwijst naar onbekende positie "${slot.positie}"`,
        );
      }
    }
  }
  return errors.length ? fail(FILE, errors) : parsed;
}
