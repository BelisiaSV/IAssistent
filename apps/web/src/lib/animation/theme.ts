export type TeamKey = "eigen" | "tegenstander" | "neutraal";

/** Look of the field and the players; every colour can be changed per team or club. */
export interface AnimationTheme {
  gras: [string, string];
  lijnen: string;
  teams: Record<TeamKey, string>;
  doelman: Partial<Record<TeamKey, string>>;
  accent: string;
}

export const DEFAULT_THEME: AnimationTheme = {
  gras: ["#6dbb55", "#63b04c"],
  lijnen: "#ffffff",
  teams: { eigen: "#ffffff", tegenstander: "#ef4444", neutraal: "#facc15" },
  doelman: { eigen: "#38a3dd", tegenstander: "#3f3f46" },
  accent: "#ffffff",
};
