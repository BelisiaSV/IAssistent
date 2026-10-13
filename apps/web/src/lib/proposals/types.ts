/**
 * Shape of the Assistant Coach output (staff/assistant-coach/output-schema.json).
 * Stored output is validated against that schema by the staff-engine.
 */
export interface WeekPlanningPart {
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
