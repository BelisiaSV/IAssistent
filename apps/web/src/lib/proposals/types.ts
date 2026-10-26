/**
 * Shape of the Assistant Coach output (staff/assistant-coach/output-schema.json).
 * Stored output is validated against that schema by the staff-engine.
 */
export interface WeekPlanningPart {
  /** Exercise from the coach's library, or null/absent for a new part. */
  oefening_id?: string | null;
  fase: "opwarming" | "kern" | "afsluiting";
  naam: string;
  doel: string;
  organisatie: string;
  spelers: string;
  coachingspunten: string[];
  duur_min: number;
  reeksen: number | null;
  werk_per_reeks: string | null;
  rust_tussen_reeksen: string | null;
  intensiteit: "laag" | "matig" | "hoog" | "maximaal";
  rpe: number | null;
}

export interface WeekPlanningDay {
  datum: string;
  md: string | null;
  soort: "training" | "wedstrijd" | "rust";
  titel: string;
  doel: string;
  tijdstip: string | null;
  totale_duur_min: number | null;
  belasting: "rust" | "laag" | "matig" | "hoog" | "zeer hoog";
  onderdelen: WeekPlanningPart[];
  opmerking: string | null;
}

export interface WeekPlanningOutput {
  weekfocus: string;
  dagen: WeekPlanningDay[];
  individueel: { rugnummer: number; advies: string }[];
  aandachtspunten: string[];
  vragen_aan_coach: string[];
}

/**
 * Shape of the Physical Coach output (staff/physical-coach/output-schema.json).
 */
export interface LoadPlanBlock {
  naam: string;
  doel: string;
  duur_min: number;
  reeksen: number | null;
  werk_per_reeks: string | null;
  rust_tussen_reeksen: string | null;
  intensiteit: "laag" | "matig" | "hoog" | "maximaal";
  rpe: number | null;
  mas_pct: number | null;
  werk_sec: number | null;
}

export interface LoadPlanDay {
  datum: string;
  md: string | null;
  soort: "training" | "wedstrijd" | "rust";
  titel: string;
  tijdstip: string | null;
  totale_duur_min: number | null;
  belasting: WeekPlanningDay["belasting"];
  rpe_doel: number | null;
  au_doel: number | null;
  km_doel: number | null;
  accenten: string[];
  richtlijnen_training: string | null;
  fysieke_blokken: LoadPlanBlock[];
  opmerking: string | null;
}

export interface LoadPlanOutput {
  weektype: string;
  weekfocus: string;
  dagen: LoadPlanDay[];
  weektotaal: {
    au_doel: number;
    km_doel: number;
    referentie_max_au: number | null;
    belasting_pct: number | null;
    vergelijking: string;
  };
  test: { gepland: boolean; datum: string | null; toelichting: string };
  cyclus_advies: string | null;
  individueel: { rugnummer: number; advies: string }[];
  aandachtspunten: string[];
  vragen_aan_coach: string[];
}

/**
 * Drawing of an exercise or set piece ($defs.tekening in
 * staff/tactical-coach/output-schema.json). Coordinates are percentages of the
 * field: x 0 = left, y 0 = top.
 */
export interface Drawing {
  titel: string;
  veld: { type: "volledig" | "half" | "zone"; breedte_m: number; lengte_m: number };
  elementen: {
    soort: "speler" | "doelman" | "kegel" | "bal" | "doel" | "minidoel" | "paal";
    team: "eigen" | "tegenstander" | "neutraal" | null;
    label: string | null;
    x: number;
    y: number;
  }[];
  pijlen: {
    soort: "pass" | "loop" | "dribbel" | "schot";
    van_x: number;
    van_y: number;
    naar_x: number;
    naar_y: number;
    label: string | null;
  }[];
  zones: { x: number; y: number; breedte: number; hoogte: number; label: string | null }[];
  uitleg: string[];
}

export type SetPieceKind =
  | "hoekschop_aanvallend"
  | "hoekschop_verdedigend"
  | "vrije_trap_aanvallend"
  | "vrije_trap_verdedigend"
  | "inworp"
  | "aftrap"
  | "strafschop";

export interface SetPiece {
  /** Set piece from the coach's library, or null/absent for a new one. */
  standaardsituatie_id?: string | null;
  titel: string;
  soort: SetPieceKind;
  afspraken: string[];
  taken: { rugnummer: number; taak: string }[];
  tekening: Drawing;
}

/** Shape of the Tactical Coach week plan (staff/tactical-coach/output-schema.json). */
export interface TacticalWeekOutput {
  tegenstander: {
    naam: string;
    formatie: string | null;
    samenvatting: string;
    sterktes: string[];
    zwaktes: string[];
    sleutelspelers: { rugnummer: number; post: string | null; aandacht: string }[];
  };
  lessen: string[];
  speelplan: {
    formatie: string;
    kernboodschap: string;
    balbezit: string[];
    balverlies: string[];
    omschakeling_aanval: string[];
    omschakeling_verdediging: string[];
    pressing: string;
  };
  standaardsituaties: SetPiece[];
  trainingsaccenten: { datum: string; md: string | null; thema: string; doel: string; aandachtspunten: string[] }[];
  aandachtspunten: string[];
  vragen_aan_coach: string[];
}

/** Shape of the Tactical Coach match preparation (taken/wedstrijdvoorbereiding/output-schema.json). */
export interface MatchPrepOutput {
  opstelling: {
    formatie: string;
    basis: { post: string; rugnummer: number; taak: string }[];
    bank: number[];
    toelichting: string;
  };
  standaardsituaties: SetPiece[];
  scenarios: { situatie: string; aanpassing: string }[];
  wedstrijdbespreking: { titel: string; kernpunten: string[]; afsluiter: string };
  aandachtspunten: string[];
  vragen_aan_coach: string[];
}

/** Shape of the Tactical Coach drawings (staff/tactical-coach/taken/oefenstof/output-schema.json). */
export interface DrawingsOutput {
  oefeningen: {
    datum: string;
    onderdeel: string;
    fase: WeekPlanningPart["fase"];
    tekening: Drawing;
    organisatie: string;
    verloop: string[];
    variaties: string[];
    coachingspunten: string[];
  }[];
  opmerkingen: string[];
}
