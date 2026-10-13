import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import { checkLogo, detectLogoKind, teamInputSchema } from "./validation";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode("<svg xmlns=");

describe("teamInputSchema", () => {
  const valid = {
    name: " Eerste ploeg ",
    season: "",
    clubName: "KFC Voorbeeld",
    primaryColor: "#112233",
    secondaryColor: "#FFFFFF",
  };

  it("trims and normalises input", () => {
    expect(teamInputSchema.parse(valid)).toEqual({ ...valid, name: "Eerste ploeg", season: null });
  });

  it("requires a team name and club name in Dutch", () => {
    const result = teamInputSchema.safeParse({ ...valid, name: "  ", clubName: "" });
    expect(result.success).toBe(false);
    const errors = result.error!.issues.map((i) => i.message);
    expect(errors).toContain(messages.teamForm.errors.nameRequired);
    expect(errors).toContain(messages.teamForm.errors.clubNameRequired);
  });

  it("rejects invalid colours", () => {
    expect(teamInputSchema.safeParse({ ...valid, primaryColor: "red" }).success).toBe(false);
  });
});

describe("detectLogoKind", () => {
  it("recognises png, jpeg and webp by their bytes", () => {
    expect(detectLogoKind(PNG)?.mimeType).toBe("image/png");
    expect(detectLogoKind(JPG)?.mimeType).toBe("image/jpeg");
    expect(detectLogoKind(WEBP)?.mimeType).toBe("image/webp");
  });

  it("rejects other files such as svg", () => {
    expect(detectLogoKind(SVG)).toBeNull();
  });
});

describe("checkLogo", () => {
  it("accepts no file", () => {
    expect(checkLogo(0, new Uint8Array())).toEqual({ ok: true, kind: null });
  });

  it("rejects files above 2 MB", () => {
    expect(checkLogo(2 * 1024 * 1024 + 1, PNG)).toEqual({
      ok: false,
      error: messages.teamForm.errors.logoSize,
    });
  });

  it("rejects files that are not images", () => {
    expect(checkLogo(100, SVG)).toEqual({ ok: false, error: messages.teamForm.errors.logoType });
  });
});
