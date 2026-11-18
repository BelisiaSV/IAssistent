import { bankScore, type BankRow, words } from "./staff";
import { bankZones } from "./zones";

export { bankZones, ZONE_COUNT } from "./zones";


/** Filters of the exercise bank (from the query string; empty = all). */
export interface BankFilters {
  q: string;
  fase: string;
  type: string;
  belasting: string;
  principe: string;
  zone: string;
}

export const BANK_FILTER_KEYS = ["q", "fase", "type", "belasting", "principe", "zone"] as const;

export function bankFilters(params: Partial<Record<string, string | string[] | undefined>>): BankFilters {
  const value = (key: string) => {
    const v = params[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  return { q: value("q"), fase: value("fase"), type: value("type"), belasting: value("belasting"), principe: value("principe"), zone: value("zone") };
}

const content = (row: BankRow) => (row.content && typeof row.content === "object" ? row.content : {}) as Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");


const sorted = (values: Iterable<string>) => [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, "nl"));

/** The values to choose from in each filter, from the exercises themselves. */
export function bankFilterOptions(rows: BankRow[]) {
  return {
    fase: sorted(rows.map((r) => r.phase ?? "")),
    type: sorted(rows.map((r) => r.kind)),
    belasting: sorted(rows.map((r) => text(content(r).belasting))),
    principe: sorted(rows.flatMap((r) => r.principles)),
  };
}

/**
 * The exercises that pass every filter. The search looks in the title, goals,
 * tags and source (best fit first); without search the order of the bank stays.
 */
export function filterBank(rows: BankRow[], f: BankFilters): BankRow[] {
  const wanted = words(f.q);
  const zone = Number(f.zone);
  return rows
    .filter(
      (r) =>
        (!f.fase || r.phase === f.fase) &&
        (!f.type || r.kind === f.type) &&
        (!f.belasting || text(content(r).belasting) === f.belasting) &&
        (!f.principe || r.principles.includes(f.principe)) &&
        (!f.zone || bankZones(r).includes(zone)),
    )
    .map((r, index) => {
      if (!wanted.length) return { r, index, score: 1 };
      const source = words(text(content(r).bron));
      const extra = wanted.filter((w) => source.some((s) => s.startsWith(w))).length;
      return { r, index, score: bankScore(r, wanted) + extra };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.r);
}
