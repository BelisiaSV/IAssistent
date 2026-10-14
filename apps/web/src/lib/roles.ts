import { FEATURE_FLAGS, type FeatureFlagKey } from "@iassistent/db";

/**
 * Steps of the AI staff on the week page, in working order:
 * 1-2. Physical Coach (load plan) and Tactical Coach (match plan), side by side;
 * 3.   Assistant Coach builds the trainings within both approved plans;
 * 4.   Tactical Coach draws the exercises of the approved week planning.
 * `uses` = roles whose approved default proposal of this week goes along as "staf".
 * `requires` = roles that must have an approved proposal before this step can run.
 */
export const WEEK_STEPS = [
  { key: "pc", role: "physical-coach", task: "default", flag: FEATURE_FLAGS.physicalCoach, uses: [], requires: [] },
  { key: "tc", role: "tactical-coach", task: "default", flag: FEATURE_FLAGS.tacticalCoach, uses: [], requires: [] },
  {
    key: "ac",
    role: "assistant-coach",
    task: "default",
    flag: FEATURE_FLAGS.assistantCoach,
    uses: ["physical-coach", "tactical-coach"],
    requires: [],
  },
  {
    key: "tco",
    role: "tactical-coach",
    task: "oefenstof",
    flag: FEATURE_FLAGS.tacticalCoach,
    uses: ["assistant-coach", "physical-coach"],
    requires: ["assistant-coach"],
  },
] as const satisfies readonly {
  key: string;
  role: string;
  task: string;
  flag: FeatureFlagKey;
  uses: readonly string[];
  requires: readonly string[];
}[];

export type WeekStep = (typeof WEEK_STEPS)[number];
export type WeekStepKey = WeekStep["key"];

export function weekStep(key: string): WeekStep | null {
  return WEEK_STEPS.find((s) => s.key === key) ?? null;
}
