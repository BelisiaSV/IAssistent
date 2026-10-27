import type { TacticalWeekOutput, WeekPlanningDay, WeekPlanningOutput } from "./types";

/** Intensity bars (0–5) for the week overview, from the day load of the Assistant Coach. */
const INTENSITY: Record<WeekPlanningDay["belasting"], number> = { rust: 0, laag: 2, matig: 3, hoog: 4, "zeer hoog": 5 };
export const INTENSITY_MAX = 5;

export interface OverviewMatch {
  date: string;
  start: string | null;
  opponent: string;
  home: boolean;
}

export interface OverviewDay {
  datum: string;
  md: string | null;
  soort: WeekPlanningDay["soort"];
  objective: string;
  content: string[];
  focus: string | null;
  start: string | null;
  durationMin: number | null;
  match: OverviewMatch | null;
  /** Day load of the Assistant Coach ("rust" … "zeer hoog"). */
  load: WeekPlanningDay["belasting"];
  intensity: number;
}

export interface WeekOverview {
  keyMessage: string | null;
  days: OverviewDay[];
}

/**
 * The week at a glance for the players: per day the goal, the main content
 * (the kern parts, or all parts when there is no kern), the tactical focus,
 * time and intensity. Everything comes from the approved staff outputs.
 */
export function weekOverview(
  ac: WeekPlanningOutput,
  tc: Pick<TacticalWeekOutput, "speelplan" | "trainingsaccenten"> | null,
  matches: OverviewMatch[],
): WeekOverview {
  return {
    keyMessage: tc?.speelplan.kernboodschap ?? null,
    days: ac.dagen.map((day) => {
      const match = matches.find((m) => m.date === day.datum) ?? null;
      const kern = day.onderdelen.filter((p) => p.fase === "kern");
      return {
        datum: day.datum,
        md: day.md,
        soort: day.soort,
        objective: day.titel,
        content: (kern.length ? kern : day.onderdelen).map((p) => p.naam).slice(0, 4),
        focus: tc?.trainingsaccenten.find((a) => a.datum === day.datum)?.thema ?? null,
        start: match?.start ?? day.tijdstip,
        durationMin: day.soort === "training" ? day.totale_duur_min : null,
        match,
        load: day.belasting,
        intensity: day.soort === "wedstrijd" ? INTENSITY_MAX : INTENSITY[day.belasting],
      };
    }),
  };
}

/** Black or white text, whichever reads best on a team colour (#rrggbb). */
export function readableOn(hex: string): "#ffffff" | "#0f172a" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.4 ? "#0f172a" : "#ffffff";
}
