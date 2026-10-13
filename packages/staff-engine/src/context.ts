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
  feedback: RoleFeedback | null;
}
