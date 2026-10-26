import { z } from "zod";

/**
 * Animation format of an exercise: players, ball, areas, arrows and labels over
 * time. Coordinates are % of the field (x 0 = left, y 0 = top = goal we attack);
 * keyframes are [seconds, x, y].
 */
const pct = z.number().min(-20).max(120);
const seconds = z.number().min(0).max(600);
const key = z.tuple([seconds, pct, pct]);
const path = z.array(key).min(1).max(2000);
const timed = { van: seconds.optional(), tot: seconds.optional() };
const text = (max: number) => z.string().max(max);

const overlay = z.discriminatedUnion("soort", [
  z.object({ soort: z.literal("zone"), ...timed, stijl: z.enum(["licht", "gearceerd"]), x: pct, y: pct, breedte: pct, hoogte: pct, label: text(80).optional(), label_pos: text(20).optional() }),
  z.object({ soort: z.literal("vlak"), ...timed, stijl: z.enum(["licht", "gearceerd", "omlijnd"]), punten: z.array(z.tuple([pct, pct])).min(3).max(40), label: text(80).optional() }),
  z.object({ soort: z.literal("tekst"), ...timed, x: pct, y: pct, tekst: text(80) }),
  z.object({
    soort: z.literal("pijl"),
    ...timed,
    pijl: z.enum(["pass", "loop", "dribbel", "schot"]),
    van_x: pct,
    van_y: pct,
    naar_x: pct,
    naar_y: pct,
    buiging: z.number().min(-1).max(1).optional(),
    label: text(80).nullable().optional(),
  }),
  z.object({ soort: z.enum(["doel", "minidoel", "ballen", "kegel"]), ...timed, x: pct, y: pct }),
]);

export const animationSchema = z.object({
  titel: text(120),
  bron: text(200).optional(),
  duur_s: z.number().positive().max(600),
  veld: z.object({ type: z.enum(["volledig", "half", "zone"]), breedte_m: z.number().min(5).max(120), lengte_m: z.number().min(5).max(150) }),
  uitsnede: z.object({ x: pct, y: pct, breedte: z.number().positive().max(140), hoogte: z.number().positive().max(140) }).optional(),
  raster: z.object({ x_m: z.array(z.number()).max(20), y_m: z.array(z.number()).max(20) }).optional(),
  vast: z.array(overlay).max(100).default([]),
  overlays: z.array(overlay).max(200).default([]),
  spelers: z
    .array(
      z.object({
        id: text(20),
        team: z.enum(["eigen", "tegenstander", "neutraal"]),
        kleur: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        label: text(4).nullable(),
        soort: z.enum(["speler", "doelman"]),
        pad: path,
      }),
    )
    .max(40),
  bal: path,
});

export type Animation = z.infer<typeof animationSchema>;
export type AnimationOverlay = Animation["overlays"][number];

/** Parses an animation (e.g. an uploaded .json file); null when invalid. */
export function parseAnimation(raw: unknown): Animation | null {
  const parsed = animationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
