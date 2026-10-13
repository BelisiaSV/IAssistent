import "server-only";

import formationsJson from "@staff/_gedeeld/formaties.json";
import positionsJson from "@staff/_gedeeld/posities.json";
import visionJson from "@staff/_gedeeld/visieprofiel.json";
import {
  type FormationCatalog,
  type ParseResult,
  parseFormations,
  parsePositions,
  type PositionCatalog,
  parseVisionQuestionnaire,
  type VisionQuestionnaire,
} from "@iassistent/staff-engine/content";

// Content from /staff is bundled at build time and validated by the staff-engine.
// Invalid content fails the build (and `pnpm staff:validate` in CI).

function unwrap<T>(result: ParseResult<T>): T {
  if (!result.value) {
    throw new Error(
      "Invalid /staff content:\n" + result.issues.map((i) => `- ${i.path}: ${i.message}`).join("\n"),
    );
  }
  return result.value;
}

export const positionCatalog: PositionCatalog = unwrap(parsePositions(positionsJson));
export const formationCatalog: FormationCatalog = unwrap(
  parseFormations(formationsJson, positionCatalog),
);
export const visionQuestionnaire: VisionQuestionnaire = unwrap(parseVisionQuestionnaire(visionJson));
