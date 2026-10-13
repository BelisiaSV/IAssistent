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
