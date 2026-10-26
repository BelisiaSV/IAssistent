import { describe, expect, it } from "vitest";

import { libraryExercise } from "./library";
import { exerciseFormSchema } from "./validation";

const form = (over: Record<string, unknown> = {}) => ({
  title: "Positiespel",
  phase: "kern",
  labels: "Balbezit, opbouw",
  minPlayers: "",
  maxPlayers: "",
  duration: "",
  sets: "",
  workMin: "",
  restMin: "",
  intensity: "",
  rpe: "",
  useInPlanning: true,
  organisation: "",
  course: "",
  coaching: "",
  variations: "",
  ...over,
});

describe("exercise form", () => {
  it("reads the standard load, with a decimal comma", () => {
    const v = exerciseFormSchema.parse(form({ sets: "4", workMin: "4,5", restMin: "1.5", intensity: "hoog", rpe: "7", useInPlanning: false }));
    expect(v).toMatchObject({ sets: 4, workMin: 4.5, restMin: 1.5, intensity: "hoog", rpe: 7, useInPlanning: false });
    expect(exerciseFormSchema.parse(form())).toMatchObject({ sets: null, workMin: null, restMin: null, intensity: null, rpe: null });
  });

  it("rejects a load out of range", () => {
    expect(exerciseFormSchema.safeParse(form({ sets: "0" })).success).toBe(false);
    expect(exerciseFormSchema.safeParse(form({ workMin: "abc" })).success).toBe(false);
    expect(exerciseFormSchema.safeParse(form({ rpe: "11" })).success).toBe(false);
    expect(exerciseFormSchema.safeParse(form({ intensity: "extreem" })).success).toBe(false);
  });
});

describe("library for the staff", () => {
  it("maps an exercise to Dutch keys without media", () => {
    const e = libraryExercise({
      id: "e1",
      title: "Rondo",
      phase: "opwarming",
      labels: ["rondo"],
      min_players: 7,
      max_players: 9,
      duration_min: 12,
      sets: 3,
      work_min: 3,
      rest_min: 1,
      intensity: "matig",
      rpe: 5,
      organisation: "15 x 15 m",
      course: ["5 rond, 2 in het midden"],
      coaching_points: ["Lichaamshouding open"],
      variations: [],
      animation: { titel: "Rondo" },
    });
    expect(e).toMatchObject({ id: "e1", titel: "Rondo", fase: "opwarming", spelers: { min: 7, max: 9 }, reeksen: 3, werk_min: 3, rust_min: 1, animatie: true });
    expect(JSON.stringify(e)).not.toContain("video");
  });
});
