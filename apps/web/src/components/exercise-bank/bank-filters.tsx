import Link from "next/link";

import { type BankFilters, ZONE_COUNT } from "@/lib/exercise-bank/filters";
import { messages } from "@/lib/messages";

const m = messages.exerciseBank.filters;

/** Search and filters of the exercise bank (a GET form: the filters stay in the address). */
export function BankFilterForm({
  filters,
  options,
  hidden = {},
}: {
  filters: BankFilters;
  options: { fase: string[]; type: string[]; belasting: string[]; principe: string[] };
  /** Other parameters to keep, e.g. the status filter of the admin. */
  hidden?: Record<string, string>;
}) {
  const select = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  const choice = (name: keyof typeof options, all: string) => (
    <select name={name} defaultValue={filters[name]} aria-label={all} className={select}>
      <option value="">{all}</option>
      {options[name].map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
  const active = Object.values(filters).some(Boolean);
  return (
    <form className="space-y-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input name="q" defaultValue={filters.q} placeholder={m.search} aria-label={m.search} className={select} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {choice("fase", m.allPhases)}
        {choice("type", m.allTypes)}
        {choice("belasting", m.allLoads)}
        {choice("principe", m.allPrinciples)}
        <select name="zone" defaultValue={filters.zone} aria-label={m.allZones} className={select}>
          <option value="">{m.allZones}</option>
          {Array.from({ length: ZONE_COUNT }, (_, i) => i + 1).map((z) => (
            <option key={z} value={z}>
              {m.zone(z)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">{m.apply}</button>
        {active && (
          <Link href={`?${new URLSearchParams(hidden).toString()}`} className="text-sm text-slate-600 hover:underline">
            {m.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
