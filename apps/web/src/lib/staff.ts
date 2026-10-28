import "server-only";

import type { Staff } from "@iassistent/staff-engine/content";

import bundle from "@/generated/staff.json";

// /staff is validated by the staff-engine and bundled into src/generated/staff.json
// at build time (`pnpm run staff:bundle`). Invalid content fails the build.
export const staff = bundle as unknown as Staff;

export const positionCatalog = staff.positions;
export const formationCatalog = staff.formations;
export const visionQuestionnaire = staff.vision;
export const matchDayCatalog = staff.matchDays;
export const periodizationCatalog = staff.periodization;
export const testCatalog = staff.tests;

export interface RoleSummary {
  id: string;
  name: string;
  status: string;
  /** First paragraph of the "Doel" section of rol.md. */
  goal: string | null;
}

/** The roles of the staff with their name, status and goal (from rol.md). */
export function roleSummaries(): RoleSummary[] {
  return staff.roles.map((role) => {
    const section = /^## Doel\s*\n([\s\S]*?)(?=\n## |(?![\s\S]))/m.exec(role.description)?.[1] ?? "";
    const paragraph = section.trim().split(/\n\s*\n/)[0]?.replace(/\s*\n\s*/g, " ").trim();
    return { id: role.id, name: role.meta.naam, status: role.meta.status, goal: paragraph || null };
  });
}
