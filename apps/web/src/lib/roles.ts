import { FEATURE_FLAGS, type FeatureFlagKey } from "@iassistent/db";

/**
 * AI staff roles available in the week planning, in the order they work:
 * the Physical Coach plans the load, the Assistant Coach builds the trainings
 * within the approved load plan.
 */
export const WEEK_ROLES = [
  { id: "physical-coach", param: "pc", flag: FEATURE_FLAGS.physicalCoach, uses: [] },
  { id: "assistant-coach", param: "ac", flag: FEATURE_FLAGS.assistantCoach, uses: ["physical-coach"] },
] as const satisfies readonly { id: string; param: string; flag: FeatureFlagKey; uses: readonly string[] }[];

export type WeekRoleId = (typeof WEEK_ROLES)[number]["id"];

export function weekRole(id: string) {
  return WEEK_ROLES.find((r) => r.id === id) ?? null;
}
