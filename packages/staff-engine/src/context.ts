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

/** Next opponent: fiche and last known lineup (shirt numbers per slot, no names). */
export interface OpponentContext {
  naam: string;
  thuis: boolean | null;
  formatie: string | null;
  speelstijl: string | null;
  sterktes: string | null;
  zwaktes: string | null;
  standaardsituaties: string | null;
  notities: string | null;
  opstelling: {
    bron: "coach" | "video";
    datum: string | null;
    formatie: string;
    basis: { post: string; rugnummer: number | null }[];
    bank: (number | null)[];
  } | null;
}

/** Findings of the head coach after a match. */
export interface MatchEvaluation {
  datum: string;
  tegenstander: string;
  thuis: boolean | null;
  uitslag: string | null;
  eigen_formatie: string | null;
  formatie_tegenstander: string | null;
  zelfde_formatie_als_tegenstander: boolean;
  wat_ging_goed: string | null;
  wat_ging_slecht: string | null;
  lessen: string | null;
}

export interface RoleContext {
  weekinput: WeekInput;
  kern: SquadPlayer[];
  visie: VisionContext;
  belastingshistoriek: LoadHistoryWeek[];
  testen: TestStatus[];
  tegenstander: OpponentContext | null;
  evaluaties: MatchEvaluation[];
  /** Approved proposals of other roles for this week, by role id. */
  staf: Record<string, unknown>;
  feedback: RoleFeedback | null;
}
