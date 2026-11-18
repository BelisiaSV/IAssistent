import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { layoutLineup, PITCH_TOP, PITCH_UNIT } from "./lineup-layout";

type Formation = { code: string; posten: { x: number; y: number }[] };

const formations = (
  JSON.parse(
    readFileSync(
      join(__dirname, "../../../../../staff/_gedeeld/formaties.json"),
      "utf8",
    ),
  ) as { formaties: Formation[] }
).formaties;

const px = (y: number) => PITCH_TOP + y * PITCH_UNIT;

describe("layoutLineup", () => {
  it("returns nothing for an empty lineup", () => {
    expect(layoutLineup([], { withDetail: false })).toEqual({
      ys: [],
      scale: 1,
    });
  });

  for (const withDetail of [false, true]) {
    for (const f of formations) {
      it(`leaves room for every label in ${f.code} (first name: ${withDetail})`, () => {
        const slots = f.posten;
        const { ys, scale } = layoutLineup(
          slots.map((s) => s.y),
          { withDetail },
        );
        const need = (withDetail ? 136 : 112) * scale;
        // Two players whose shirts and labels could touch (close in x) are
        // either on the same line or far enough apart vertically.
        for (let a = 0; a < slots.length; a++) {
          for (let b = 0; b < slots.length; b++) {
            const sa = slots[a]!;
            const sb = slots[b]!;
            if (a === b || sb.y - sa.y <= 10) continue;
            if (Math.abs(sa.x - sb.x) > 30) continue;
            expect(px(ys[b]!) - px(ys[a]!)).toBeGreaterThanOrEqual(need - 0.01);
          }
        }
        // Order is kept and everything stays on the pitch.
        const keeper = slots.findIndex(
          (s) => s.y === Math.max(...slots.map((p) => p.y)),
        );
        expect(Math.max(...ys)).toBe(ys[keeper]);
        expect(px(ys[keeper]!)).toBeLessThanOrEqual(709);
        expect(Math.min(...ys)).toBeGreaterThan(10);
      });
    }
  }
});
