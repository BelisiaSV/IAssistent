import type { WeekPeriodization } from "./shared/periodization";

/**
 * Data a role gets about the week. Keys are Dutch because this data goes to the
 * AI as-is (all AI input and output is Dutch). No player names: rugnummer only.
 */
export interface WeekDayInput {
  datum: string;
  weekdag: string;
  md: string | null;
  training: { aanvang: string; duur_min: number } | null;
  wedstrijd: { aanvang: string | null; tegenstander: string; thuis: boolean } | null;
}

export interface WeekInput {
  week_van: string;
  periodisering: WeekPeriodization;
  vorige_wedstrijd: string | null;
  notitie: string | null;
  dagen: WeekDayInput[];
}

export interface SquadPlayer {
  rugnummer: number | null;
  posities: string[];
  voet: string | null;
  beschikbaar: boolean;
  status: string;
  terug_verwacht: string | null;
  /** Latest MAS in km/h (VAMEVAL) and its date. */
  mas_kmh: number | null;
  mas_test_datum: string | null;
}

export interface LoadHistoryWeek {
  week_van: string;
  weektype: string | null;
  gepland_au: number | null;
  werkelijk_au: number | null;
  sessies: { datum: string; soort: "training" | "wedstrijd"; rpe: number; duur_min: number; au: number; aanwezigen: number | null }[];
}

export interface TestStatus {
  test: string;
  naam: string;
  laatste_test: string | null;
  interval_weken: number;
  nieuwe_test_nodig: boolean;
  spelers_met_resultaat: number;
}

export interface VisionContext {
  samenvatting: string | null;
  antwoorden: { thema: string; vraag: string; antwoord: string | string[] | number }[];
}

export interface RoleFeedback {
  vorige_versie: unknown;
  feedback: string;
}

export interface RoleContext {
  weekinput: WeekInput;
  kern: SquadPlayer[];
  visie: VisionContext;
  belastingshistoriek: LoadHistoryWeek[];
  testen: TestStatus[];
  /** Approved proposals of other roles for this week, by role id. */
  staf: Record<string, unknown>;
  feedback: RoleFeedback | null;
}
