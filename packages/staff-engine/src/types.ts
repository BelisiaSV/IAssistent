import type { FormationCatalog } from "./shared/formations";
import type { MatchDayCatalog } from "./shared/matchdays";
import type { PeriodizationCatalog } from "./shared/periodization";
import type { TestCatalog } from "./shared/tests";
import type { PositionCatalog } from "./shared/positions";
import type { VisionQuestionnaire } from "./shared/vision";

export const ROLE_STATUSES = ["placeholder", "concept", "actief"] as const;
export type RoleStatus = (typeof ROLE_STATUSES)[number];

/** A text file from /staff, with its path relative to the staff root. */
export interface StaffFile {
  path: string;
  content: string;
}

/** Frontmatter of a role's rol.md. Keys are Dutch because they are content. */
export interface RoleMeta {
  id: string;
  naam: string;
  versie: string;
  status: RoleStatus;
}

export interface StaffRole {
  id: string;
  meta: RoleMeta;
  /** rol.md without frontmatter. */
  description: string;
  /** instructies.md */
  instructions: string;
  /** Parsed output-schema.json (a JSON Schema). */
  outputSchema: Record<string, unknown>;
  /** referentie/ */
  references: StaffFile[];
  /** voorbeelden/ */
  examples: StaffFile[];
  /** tests/ */
  tests: StaffFile[];
}

export interface Staff {
  rootDir: string;
  /** All files in _gedeeld/ (including the role template). */
  shared: StaffFile[];
  roles: StaffRole[];
  /** _gedeeld/posities.json */
  positions: PositionCatalog;
  /** _gedeeld/formaties.json */
  formations: FormationCatalog;
  /** _gedeeld/visieprofiel.json */
  vision: VisionQuestionnaire;
  /** _gedeeld/wedstrijddagen.json */
  matchDays: MatchDayCatalog;
  /** _gedeeld/periodisering.json */
  periodization: PeriodizationCatalog;
  /** _gedeeld/testen.json */
  tests: TestCatalog;
}

export interface StaffIssue {
  /** Path relative to the staff root. */
  path: string;
  message: string;
}

export class StaffValidationError extends Error {
  constructor(public readonly issues: StaffIssue[]) {
    super(
      `Ongeldige staff-inhoud (${issues.length} probleem/problemen):\n` +
        issues.map((i) => `- ${i.path}: ${i.message}`).join("\n"),
    );
    this.name = "StaffValidationError";
  }
}
