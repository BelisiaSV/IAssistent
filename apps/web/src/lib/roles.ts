import { FEATURE_FLAGS, type FeatureFlagKey } from "@iassistent/db";

export type RunKind = "week" | "match";

export interface RunStep {
  key: string;
  role: string;
  task: string;
  flag: FeatureFlagKey;
  /** Steps of the same run that must be done first; their output goes along as "staf". */
  after: readonly string[];
  /** Steps that must be part of the run for this step to run at all. */
  requires: readonly string[];
}

/**
 * The stafmeeting. One request of the head coach starts a run; the steps work
 * in this order:
 * - week document: Physical Coach and Tactical Coach (week plan) side by side,
 *   then the Assistant Coach builds the trainings within both, then the
 *   Tactical Coach draws every exercise;
 * - match preparation (after the last training): the Tactical Coach, with the
 *   approved week document as "staf".
 */
export const RUN_STEPS: Record<RunKind, readonly RunStep[]> = {
  week: [
    { key: "pc", role: "physical-coach", task: "default", flag: FEATURE_FLAGS.physicalCoach, after: [], requires: [] },
    { key: "tc", role: "tactical-coach", task: "default", flag: FEATURE_FLAGS.tacticalCoach, after: [], requires: [] },
    { key: "ac", role: "assistant-coach", task: "default", flag: FEATURE_FLAGS.assistantCoach, after: ["pc", "tc"], requires: [] },
    { key: "tco", role: "tactical-coach", task: "oefenstof", flag: FEATURE_FLAGS.tacticalCoach, after: ["ac", "pc"], requires: ["ac"] },
  ],
  match: [
    {
      key: "match",
      role: "tactical-coach",
      task: "wedstrijdvoorbereiding",
      flag: FEATURE_FLAGS.tacticalCoach,
      after: [],
      requires: [],
    },
  ],
};

/** Steps of the week document whose approved output goes along with the match preparation. */
export const MATCH_USES_WEEK_STEPS = ["pc", "tc"] as const;

/** Steps of a run for this coach: flag on and every required step present. */
export function activeSteps(kind: RunKind, enabled: (flag: FeatureFlagKey) => boolean): RunStep[] {
  const steps: RunStep[] = [];
  for (const step of RUN_STEPS[kind]) {
    if (enabled(step.flag) && step.requires.every((key) => steps.some((s) => s.key === key))) steps.push(step);
  }
  return steps;
}

/** Steps to work out again when the head coach adjusts one step (null = all):
 *  that step and every step that builds on it. */
export function stepsToRerun(steps: readonly RunStep[], feedbackStep: string | null): Set<string> {
  if (!feedbackStep) return new Set(steps.map((s) => s.key));
  const rerun = new Set([feedbackStep]);
  for (const step of steps) {
    if (step.after.some((key) => rerun.has(key))) rerun.add(step.key);
  }
  return rerun;
}

type StepState = { step: string; status: string };

/** Pending steps whose earlier steps (within the run) are ready. */
export function nextSteps(steps: readonly RunStep[], states: readonly StepState[]): RunStep[] {
  const status = new Map(states.map((s) => [s.step, s.status]));
  return steps.filter(
    (step) =>
      status.get(step.key) === "pending" &&
      step.after.every((key) => !status.has(key) || status.get(key) === "ready"),
  );
}

/** Status of a run from its steps. */
export function runStatus(states: readonly StepState[]): "generating" | "ready" | "failed" {
  if (states.some((s) => s.status === "failed")) return "failed";
  if (states.length && states.every((s) => s.status === "ready")) return "ready";
  return "generating";
}
