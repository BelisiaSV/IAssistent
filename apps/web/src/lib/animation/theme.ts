export type TeamKey = "eigen" | "tegenstander" | "neutraal";

/** Look of the field and the players; every colour can be changed per team or club. */
export interface AnimationTheme {
  /** Two tones of the chequered grass. */
  gras: [string, string];
  /** Surroundings of the pitch. */
  rand: string;
  lijnen: string;
  lijnDikte: number;
  /** Darken the edges of the picture (0 = off). */
  vignet: number;
  /** Perspective: width of the far end compared to the near end (1 = flat, 0.85 = tilted). */
  kanteling: number;
  teams: Record<TeamKey, string>;
  doelman: Partial<Record<TeamKey, string>>;
  /** Metallic shine on the tokens (0 = matt, 1 = chrome). */
  glans: number;
  accent: string;
}

/** Dark, slightly tilted pitch with glossy tokens. */
export const NIGHT_THEME: AnimationTheme = {
  gras: ["#2c2e31", "#25272a"],
  rand: "#1b1c1e",
  lijnen: "#f4f4f5",
  lijnDikte: 0.12,
  vignet: 0.55,
  kanteling: 0.86,
  teams: { eigen: "#d4d4d8", tegenstander: "#dc2626", neutraal: "#f59e0b" },
  doelman: { eigen: "#facc15", tegenstander: "#10b981" },
  glans: 0.9,
  accent: "#ffffff",
};

/** Light, flat chequered grass. */
export const DAY_THEME: AnimationTheme = {
  gras: ["#6dbb55", "#63b04c"],
  rand: "#5aa645",
  lijnen: "#ffffff",
  lijnDikte: 0.17,
  vignet: 0,
  kanteling: 1,
  teams: { eigen: "#ffffff", tegenstander: "#ef4444", neutraal: "#facc15" },
  doelman: { eigen: "#38a3dd", tegenstander: "#3f3f46" },
  glans: 0.4,
  accent: "#ffffff",
};

export const DEFAULT_THEME = NIGHT_THEME;
