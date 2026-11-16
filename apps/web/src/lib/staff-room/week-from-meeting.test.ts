import { describe, expect, it } from "vitest";

import bundle from "@/generated/staff.json";
import type { Staff } from "@iassistent/staff-engine/content";
import { validateOutput } from "@iassistent/staff-engine";

import { weekDocumentFromMeeting, weekInputFromPlan } from "./week-from-meeting";

const staff = bundle as unknown as Staff;
const example = JSON.parse(
  staff.roles.find((r) => r.id === "coordinator")!.tasks.find((t) => t.id === "staffkamer")!.examples.find((f) => f.path.endsWith("/overzicht.json"))!.content,
);

describe("week plan of the staff room in the microcycle", () => {
  it("becomes a valid week document of the Assistant Coach", () => {
    const doc = weekDocumentFromMeeting(example.overzicht);
    const schema = staff.roles.find((r) => r.id === "assistant-coach")!.outputSchema;
    expect(validateOutput(schema, doc)).toEqual({ ok: true });
    expect(doc.dagen).toHaveLength(7);
    expect(doc.individueel.map((i) => i.rugnummer)).toEqual([8, 4, 9, 13]);
  });

  it("gives the trainings and the match for a new week input", () => {
    const input = weekInputFromPlan(example.overzicht.weekplan, (date) => (date === "2026-11-22" ? { name: "Ander FC", home: false } : null), "Wedstrijd");
    expect(input.trainings.map((t) => t.date)).toEqual(["2026-11-17", "2026-11-19", "2026-11-20"]);
    expect(input.matches).toEqual([{ date: "2026-11-22", start: "15:00", opponent: "Ander FC", home: false }]);
  });
});
