import { z } from "zod";

import { type AnimationTheme, DAY_THEME, NIGHT_THEME, type TeamKey } from "./theme";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Display settings of animations per team (teams.animation_settings). */
export const animationSettingsSchema = z.object({
  stijl: z.enum(["donker", "licht"]).default("donker"),
  eigen: color.optional(),
  tegenstander: color.optional(),
  neutraal: color.optional(),
  doelman_eigen: color.optional(),
  doelman_tegenstander: color.optional(),
  /** Team logo on the tokens: none, own team only, or every token. */
  logo_op_schijfjes: z.enum(["geen", "eigen", "alle"]).default("geen"),
});
export type AnimationSettings = z.infer<typeof animationSettingsSchema>;

export function animationSettings(raw: unknown): AnimationSettings {
  const parsed = animationSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : animationSettingsSchema.parse({});
}

/** Theme and logo placement for a team. */
export function themeForTeam(raw: unknown): { theme: AnimationTheme; logoOn: TeamKey[]; settings: AnimationSettings } {
  const s = animationSettings(raw);
  const base = s.stijl === "licht" ? DAY_THEME : NIGHT_THEME;
  const theme: AnimationTheme = {
    ...base,
    teams: {
      eigen: s.eigen ?? base.teams.eigen,
      tegenstander: s.tegenstander ?? base.teams.tegenstander,
      neutraal: s.neutraal ?? base.teams.neutraal,
    },
    doelman: {
      eigen: s.doelman_eigen ?? base.doelman.eigen,
      tegenstander: s.doelman_tegenstander ?? base.doelman.tegenstander,
    },
  };
  const logoOn: TeamKey[] =
    s.logo_op_schijfjes === "alle" ? ["eigen", "tegenstander", "neutraal"] : s.logo_op_schijfjes === "eigen" ? ["eigen"] : [];
  return { theme, logoOn, settings: s };
}

/** Drops colours equal to the default of the chosen style, so switching style keeps its own palette. */
export function compactSettings(s: AnimationSettings): AnimationSettings {
  const base = s.stijl === "licht" ? DAY_THEME : NIGHT_THEME;
  const defaults: Record<string, string | undefined> = {
    eigen: base.teams.eigen,
    tegenstander: base.teams.tegenstander,
    neutraal: base.teams.neutraal,
    doelman_eigen: base.doelman.eigen,
    doelman_tegenstander: base.doelman.tegenstander,
  };
  const out: AnimationSettings = { ...s };
  for (const key of Object.keys(defaults) as (keyof typeof defaults & keyof AnimationSettings)[]) {
    if (typeof out[key] === "string" && (out[key] as string).toLowerCase() === defaults[key]?.toLowerCase()) delete out[key];
  }
  return out;
}
