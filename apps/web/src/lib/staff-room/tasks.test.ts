import { describe, expect, it } from "vitest";

import { nextStep, plannedSteps, progressStep, statusFromSteps, stepOutput, toTaskView } from "./tasks";

describe("joint tasks", () => {
  it("plans a contribution per involved role and the final proposal of the owner", () => {
    expect(plannedSteps("assistant-coach", ["physical-coach", "assistant-coach", "physical-coach", "tactical-coach"])).toEqual([
      { position: 1, role: "physical-coach", phase: "bijdrage" },
      { position: 2, role: "tactical-coach", phase: "bijdrage" },
      { position: 3, role: "assistant-coach", phase: "eindvoorstel" },
    ]);
  });

  it("runs the steps in order and stops at a step that is busy or failed", () => {
    const s = (position: number, status: "pending" | "generating" | "ready" | "failed") => ({ position, status });
    expect(nextStep([s(2, "pending"), s(1, "ready")])).toEqual(s(2, "pending"));
    expect(nextStep([s(1, "generating"), s(2, "pending")])).toBeNull();
    expect(nextStep([s(1, "failed"), s(2, "pending")])).toBeNull();
    expect(nextStep([s(1, "ready")])).toBeNull();
  });

  it("derives the status and the progress", () => {
    expect(statusFromSteps([{ status: "ready" }, { status: "pending" }])).toBe("running");
    expect(statusFromSteps([{ status: "ready" }, { status: "failed" }])).toBe("failed");
    expect(statusFromSteps([{ status: "ready" }, { status: "ready" }])).toBe("ready");
    expect([null, "running", "ready", "approved"].map((st) => progressStep(st as never))).toEqual([0, 2, 3, 4]);
  });

  it("keeps the steps of the current version and the final proposals of earlier ones", () => {
    const out = (t: string) => ({ samenvatting: t, inhoud: t, aandachtspunten: [] });
    const task = {
      id: "t", team_id: "team", source_message_id: "m", owner_role: "assistant-coach", roles: ["physical-coach"], title: "T",
      assignment: "O", status: "ready" as const, version: 2, feedback: "Korter", created_at: "", decided_at: null,
    };
    const step = (version: number, position: number, phase: "bijdrage" | "eindvoorstel", output: unknown) => ({
      id: `${version}-${position}`, version, position, role: "x", phase, status: "ready" as const, output, provider: "example",
    });
    const view = toTaskView(task, [step(1, 1, "bijdrage", out("a")), step(1, 2, "eindvoorstel", out("v1")), step(2, 2, "eindvoorstel", out("v2")), step(2, 1, "bijdrage", out("b"))]);
    expect(view.steps.map((s) => s.id)).toEqual(["2-1", "2-2"]);
    expect(view.earlier).toEqual([{ version: 1, final: out("v1") }]);
    expect(stepOutput({ samenvatting: 1 })).toBeNull();
  });
});
