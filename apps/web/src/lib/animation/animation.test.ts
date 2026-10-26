import { describe, expect, it } from "vitest";

import { exerciseFormSchema, videoExtension } from "@/lib/exercises/validation";

import { projection } from "./projection";
import { parseAnimation } from "./schema";
import { compactSettings, themeForTeam } from "./team-theme";
import { DAY_THEME, NIGHT_THEME } from "./theme";

const animation = {
  titel: "Rondo",
  duur_s: 10,
  veld: { type: "volledig", breedte_m: 68, lengte_m: 105 },
  vast: [{ soort: "minidoel", x: 40, y: 20 }],
  overlays: [{ soort: "pijl", pijl: "pass", van: 1, tot: 3, van_x: 10, van_y: 10, naar_x: 20, naar_y: 20 }],
  spelers: [{ id: "a", team: "eigen", label: "6", soort: "speler", pad: [[0, 50, 50], [5, 55, 50]] }],
  bal: [[0, 50, 51]],
};

describe("animation format", () => {
  it("accepts a valid animation and rejects broken files", () => {
    expect(parseAnimation(animation)?.spelers[0]?.pad).toHaveLength(2);
    expect(parseAnimation({ ...animation, spelers: [{ ...animation.spelers[0], team: "blauw" }] })).toBeNull();
    expect(parseAnimation({ titel: "x" })).toBeNull();
    expect(parseAnimation("niet json")).toBeNull();
  });
});

describe("team display", () => {
  it("uses the night style by default and team colours when set", () => {
    expect(themeForTeam({}).theme.teams).toEqual(NIGHT_THEME.teams);
    const t = themeForTeam({ stijl: "licht", eigen: "#c8102e", logo_op_schijfjes: "eigen" });
    expect(t.theme.gras).toEqual(DAY_THEME.gras);
    expect(t.theme.teams.eigen).toBe("#c8102e");
    expect(t.logoOn).toEqual(["eigen"]);
    expect(themeForTeam({ logo_op_schijfjes: "alle" }).logoOn).toHaveLength(3);
    expect(themeForTeam({ eigen: "rood" }).theme.teams.eigen).toBe(NIGHT_THEME.teams.eigen);
  });

  it("does not store colours equal to the style default", () => {
    expect(compactSettings({ stijl: "donker", eigen: NIGHT_THEME.teams.eigen, tegenstander: "#000000", logo_op_schijfjes: "geen" })).toEqual({
      stijl: "donker",
      tegenstander: "#000000",
      logo_op_schijfjes: "geen",
    });
  });
});

describe("perspective", () => {
  it("keeps the near end, narrows the far end and shrinks far tokens", () => {
    const pr = projection(68, 105, 0.86);
    expect(pr.p(0, 105).x).toBeCloseTo(0);
    expect(pr.p(68, 105).x).toBeCloseTo(68);
    expect(pr.p(68, 0).x - pr.p(0, 0).x).toBeCloseTo(68 * 0.86);
    expect(pr.scale(34, 0)).toBeLessThan(pr.scale(34, 105));
    expect(projection(68, 105, 1).p(10, 20)).toEqual({ x: 10, y: 20 });
  });
});

describe("exercise form", () => {
  it("splits labels and lines and checks player numbers", () => {
    const parsed = exerciseFormSchema.parse({
      title: " Rondo 5v2 ",
      phase: "opwarming",
      labels: "Rondo, balbezit, rondo",
      minPlayers: "7",
      maxPlayers: "",
      duration: "15",
      organisation: "",
      course: "Max. 2 balcontacten\n\nWie verliest, gaat in het midden",
      coaching: "",
      variations: "",
    });
    expect(parsed).toMatchObject({ title: "Rondo 5v2", labels: ["rondo", "balbezit"], minPlayers: 7, maxPlayers: null, organisation: null });
    expect(parsed.course).toHaveLength(2);
    expect(
      exerciseFormSchema.safeParse({ title: "x", phase: "", labels: "", minPlayers: "10", maxPlayers: "4", duration: "", organisation: "", course: "", coaching: "", variations: "" }).success,
    ).toBe(false);
    expect(videoExtension("video/quicktime")).toBe("mov");
    expect(videoExtension("image/png")).toBeNull();
  });
});
