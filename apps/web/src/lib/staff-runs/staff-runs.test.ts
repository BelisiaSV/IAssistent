import { FEATURE_FLAGS } from "@iassistent/db";
import { describe, expect, it } from "vitest";

import { activeSteps, nextSteps, runStatus, stepsToRerun } from "@/lib/roles";

import { matchPrepFrom } from "./gate";

const all = () => true;
const keys = (steps: { key: string }[]) => steps.map((s) => s.key);

describe("stafmeeting order", () => {
  it("runs every role of the week document when all flags are on", () => {
    expect(keys(activeSteps("week", all))).toEqual(["pc", "tc", "ac", "tco"]);
    expect(keys(activeSteps("match", all))).toEqual(["match"]);
  });

  it("drops steps whose flag is off and the drawings without a week planning", () => {
    expect(keys(activeSteps("week", (f) => f !== FEATURE_FLAGS.tacticalCoach))).toEqual(["pc", "ac"]);
    expect(keys(activeSteps("week", (f) => f !== FEATURE_FLAGS.assistantCoach))).toEqual(["pc", "tc"]);
  });

  it("starts Physical and Tactical Coach together, then the Assistant Coach, then the drawings", () => {
    const steps = activeSteps("week", all);
    const state = (pc: string, tc: string, ac: string, tco: string) => [
      { step: "pc", status: pc },
      { step: "tc", status: tc },
      { step: "ac", status: ac },
      { step: "tco", status: tco },
    ];
    expect(keys(nextSteps(steps, state("pending", "pending", "pending", "pending")))).toEqual(["pc", "tc"]);
    expect(keys(nextSteps(steps, state("ready", "generating", "pending", "pending")))).toEqual([]);
    expect(keys(nextSteps(steps, state("ready", "ready", "pending", "pending")))).toEqual(["ac"]);
    expect(keys(nextSteps(steps, state("ready", "ready", "ready", "pending")))).toEqual(["tco"]);
    // A step that is not part of the run does not block the others.
    expect(keys(nextSteps(steps.filter((s) => s.key !== "tc"), state("ready", "x", "pending", "pending").filter((s) => s.step !== "tc")))).toEqual(["ac"]);
  });

  it("works out again only the adjusted role and what builds on it", () => {
    const steps = activeSteps("week", all);
    expect([...stepsToRerun(steps, null)]).toEqual(["pc", "tc", "ac", "tco"]);
    expect([...stepsToRerun(steps, "tc")].sort()).toEqual(["ac", "tc", "tco"]);
    expect([...stepsToRerun(steps, "pc")].sort()).toEqual(["ac", "pc", "tco"]);
    expect([...stepsToRerun(steps, "ac")].sort()).toEqual(["ac", "tco"]);
    expect([...stepsToRerun(steps, "tco")]).toEqual(["tco"]);
  });

  it("derives the status of a run", () => {
    expect(runStatus([{ step: "pc", status: "ready" }, { step: "ac", status: "pending" }])).toBe("generating");
    expect(runStatus([{ step: "pc", status: "ready" }, { step: "ac", status: "failed" }])).toBe("failed");
    expect(runStatus([{ step: "pc", status: "ready" }, { step: "ac", status: "ready" }])).toBe("ready");
  });
});

describe("match preparation", () => {
  it("opens on the day of the last training before the match", () => {
    const trainings = [{ date: "2026-10-20" }, { date: "2026-10-23" }, { date: "2026-10-22" }];
    expect(matchPrepFrom(trainings, [{ date: "2026-10-25" }], "2026-10-19")).toBe("2026-10-23");
    expect(matchPrepFrom([], [{ date: "2026-10-25" }], "2026-10-19")).toBe("2026-10-19");
    expect(matchPrepFrom(trainings, [], "2026-10-19")).toBeNull();
  });
});
