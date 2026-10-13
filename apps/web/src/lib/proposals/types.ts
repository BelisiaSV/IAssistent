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
