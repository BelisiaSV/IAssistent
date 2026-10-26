import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { daysBetween } from "./matchdays";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.periodization}`;

const range = z.object({ min: z.number().min(0), max: z.number().min(0) }).refine((r) => r.min <= r.max, "min > max");
const code = z.string().regex(/^[a-z][a-z0-9_-]*$/, "code: kleine letters");

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  standaard_cyclus: z.int().min(1),
  weektypes: z
    .array(
      z.object({
        code,
        naam: z.string().min(1),
        belasting_pct: range,
        km_zonder_wedstrijd: range,
        reeksen_factor: z.number().positive().max(3).optional(),
        uitleg: z.string().min(1),
      }),
    )
    .min(1),
  cycli: z.array(z.object({ weken: z.int().min(1).max(26), volgorde: z.array(code).min(1) })).min(1),
  voor_start: z.object({ code, naam: z.string().min(1), reeksen_factor: z.number().positive().max(3).optional(), uitleg: z.string().min(1) }),
});

export type PeriodizationCatalog = z.infer<typeof schema>;
export type WeekType = PeriodizationCatalog["weektypes"][number];

export function parsePeriodization(data: unknown): ParseResult<PeriodizationCatalog> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const p = parsed.value;
  const types = new Set(p.weektypes.map((w) => w.code));
  const errors = [
    ...duplicates(p.weektypes.map((w) => w.code)).map((c) => `weektype "${c}" komt dubbel voor`),
    ...duplicates(p.cycli.map((c) => String(c.weken))).map((c) => `cyclus van ${c} weken komt dubbel voor`),
  ];
  for (const cycle of p.cycli) {
    if (cycle.volgorde.length !== cycle.weken) {
      errors.push(`cyclus van ${cycle.weken} weken heeft ${cycle.volgorde.length} weken in de volgorde`);
    }
    for (const c of cycle.volgorde) {
      if (!types.has(c)) errors.push(`cyclus van ${cycle.weken} weken: onbekend weektype "${c}"`);
    }
  }
  if (!p.cycli.some((c) => c.weken === p.standaard_cyclus)) {
    errors.push(`standaard_cyclus ${p.standaard_cyclus} bestaat niet in cycli`);
  }
  if (types.has(p.voor_start.code)) errors.push(`voor_start gebruikt de code van een weektype`);
  return errors.length ? fail(FILE, errors) : parsed;
}

export interface WeekPeriodization {
  fase: "voorbereiding" | "competitie" | null;
  /** Week number within the phase (1 = first week of the preparation or competition). */
  week_van_fase: number | null;
  cyclus_weken: number | null;
  week_in_cyclus: number | null;
  weektype: {
    code: string;
    naam: string;
    uitleg: string;
    belasting_pct: { min: number; max: number } | null;
    km_zonder_wedstrijd: { min: number; max: number } | null;
    /** Multiplier for the number of sets of a library exercise in this week type. */
    reeksen_factor?: number;
  } | null;
}

/** Season planning of a team: preparation and competition, each with its own cycle. */
export interface SeasonPlan {
  preparationStart: string | null;
  preparationWeeks: number;
  competitionStart: string | null;
  competitionWeeks: number;
}

const NONE: WeekPeriodization = { fase: null, week_van_fase: null, cyclus_weken: null, week_in_cyclus: null, weektype: null };

/** Whole weeks from the week (Monday) of `start` to the week starting on `weekStart`. */
function weeksSince(start: string, weekStart: string) {
  const offsetToMonday = (new Date(`${start}T00:00:00Z`).getUTCDay() + 6) % 7;
  return Math.floor((daysBetween(start, weekStart) + offsetToMonday) / 7);
}

function inCycle(weeks: number, cycleWeeks: number, catalog: PeriodizationCatalog) {
  const cycle = catalog.cycli.find((c) => c.weken === cycleWeeks) ?? catalog.cycli.find((c) => c.weken === catalog.standaard_cyclus)!;
  const index = weeks % cycle.weken;
  const type = catalog.weektypes.find((w) => w.code === cycle.volgorde[index])!;
  return { week_van_fase: weeks + 1, cyclus_weken: cycle.weken, week_in_cyclus: index + 1, weektype: type };
}

/**
 * Week type for the week starting on `weekStart` (a Monday). The competition
 * cycle starts in the week of the first competition match; the preparation
 * cycle in the week of the start of the preparation. Without a preparation
 * start, every week before the competition is "voor_start".
 */
export function weekPeriodization(weekStart: string, season: SeasonPlan, catalog: PeriodizationCatalog): WeekPeriodization {
  if (season.competitionStart) {
    const weeks = weeksSince(season.competitionStart, weekStart);
    if (weeks >= 0) return { fase: "competitie", ...inCycle(weeks, season.competitionWeeks, catalog) };
  }
  if (season.preparationStart) {
    const weeks = weeksSince(season.preparationStart, weekStart);
    return weeks >= 0 ? { fase: "voorbereiding", ...inCycle(weeks, season.preparationWeeks, catalog) } : NONE;
  }
  if (!season.competitionStart) return NONE;
  return {
    ...NONE,
    fase: "voorbereiding",
    weektype: { ...catalog.voor_start, belasting_pct: null, km_zonder_wedstrijd: null },
  };
}
