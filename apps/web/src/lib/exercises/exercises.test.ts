import { describe, expect, it } from "vitest";

import { libraryExercise, setPieceRoles } from "./library";
import { exerciseFormSchema, parseRole } from "./validation";

const form = (over: Record<string, unknown> = {}) => ({
  kind: "exercise",
  setPieceType: "",
  signal: "",
  roles: "",
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

  it("needs a type for a set piece and reads its roles", () => {
    expect(exerciseFormSchema.safeParse(form({ kind: "set_piece" })).success).toBe(false);
    expect(exerciseFormSchema.safeParse(form({ kind: "set_piece", setPieceType: "onbekend" })).success).toBe(false);
    const v = exerciseFormSchema.parse(form({ kind: "set_piece", setPieceType: "inworp", signal: " Lang ", roles: "Gooier – lange inworp\n\nKopper" }));
    expect(v).toMatchObject({ setPieceType: "inworp", signal: "Lang", roles: [{ rol: "Gooier", vereiste: "lange inworp" }, { rol: "Kopper", vereiste: null }] });
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
      kind: "exercise",
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
      set_piece_type: null,
      signal: null,
      roles: [],
    });
    expect(e).toMatchObject({ id: "e1", titel: "Rondo", fase: "opwarming", spelers: { min: 7, max: 9 }, reeksen: 3, werk_min: 3, rust_min: 1, animatie: true });
    expect(JSON.stringify(e)).not.toContain("video");
    expect(e).toMatchObject({ soort: "oefening", standaardsituatie: null });
  });

  it("maps a set piece with its roles", () => {
    const e = libraryExercise({
      id: "s1",
      kind: "set_piece",
      title: "Corner kort",
      phase: null,
      labels: [],
      min_players: null,
      max_players: null,
      duration_min: null,
      sets: null,
      work_min: null,
      rest_min: null,
      intensity: null,
      rpe: null,
      organisation: null,
      course: ["Kort op de 10"],
      coaching_points: [],
      variations: [],
      animation: null,
      set_piece_type: "hoekschop_aanvallend",
      signal: "Twee vingers",
      roles: [{ rol: "Nemer", vereiste: "linksvoetig" }, { fout: true }],
    });
    expect(e).toMatchObject({ soort: "standaardsituatie", standaardsituatie: { type: "hoekschop_aanvallend", teken: "Twee vingers", rollen: [] } });
    expect(setPieceRoles([{ rol: "Nemer", vereiste: "linksvoetig" }])).toEqual([{ rol: "Nemer", vereiste: "linksvoetig" }]);
  });

  it("reads roles from the form", () => {
    expect(parseRole("Nemer – linksvoetig")).toEqual({ rol: "Nemer", vereiste: "linksvoetig" });
    expect(parseRole("Eerste paal - kopsterk")).toEqual({ rol: "Eerste paal", vereiste: "kopsterk" });
    expect(parseRole("Blocker: op de doelman")).toEqual({ rol: "Blocker", vereiste: "op de doelman" });
    expect(parseRole("Rebound")).toEqual({ rol: "Rebound", vereiste: null });
    expect(parseRole("Zone-verdediger")).toEqual({ rol: "Zone-verdediger", vereiste: null });
  });
});
