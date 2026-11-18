import Link from "next/link";

import { BankFilterForm } from "@/components/exercise-bank/bank-filters";
import { ZoneMap } from "@/components/exercise-bank/zone-map";
import { requireUser } from "@/lib/auth";
import { bankFilterOptions, bankFilters, bankZones, filterBank } from "@/lib/exercise-bank/filters";
import { bankMediaUrls } from "@/lib/exercise-bank/load";
import { BANK_COLUMNS, type BankRow } from "@/lib/exercise-bank/staff";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const m = messages.exerciseBank.coach;
const f = messages.exerciseBank.filters;

/** The approved exercises of the platform's exercise bank, for every coach, with search and filters. */
export default async function ExerciseBankPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = bankFilters(await searchParams);
  await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: own }] = await Promise.all([
    supabase.from("bank_exercises").select(BANK_COLUMNS).eq("status", "approved").order("number").limit(500),
    supabase.from("exercises").select("id, bank_number").not("bank_number", "is", null),
  ]);
  const all = (data ?? []) as BankRow[];
  const copied = new Map((own ?? []).map((x) => [x.bank_number!, x.id]));
  const shown = filterBank(all, filters);
  const urls = await bankMediaUrls(supabase, shown.filter((x) => x.media_kind !== "video").map((x) => x.media_path ?? null));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      {all.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">{m.empty}</p>
      ) : (
        <>
          <BankFilterForm filters={filters} options={bankFilterOptions(all)} />
          <p className="text-sm text-slate-500">{f.count(shown.length, all.length)}</p>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-600">{m.noResults}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((x) => {
                const c = (x.content ?? {}) as { hoofddoel?: unknown; belasting?: unknown };
                const zones = bankZones(x);
                const image = x.media_path && x.media_kind !== "video" ? urls.get(x.media_path) : undefined;
                return (
                  <li key={x.number}>
                    <Link
                      href={`/exercises/bank/${x.number}`}
                      className="flex h-full flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono">{x.number}</span>
                        <span className="flex gap-1">
                          {x.media_path && x.media_kind === "video" && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{m.video}</span>}
                          {copied.has(x.number) && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">{m.inLibrary}</span>}
                        </span>
                      </span>
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="" className="h-32 w-full rounded-lg bg-white object-contain" />
                      )}
                      <span className="flex gap-3">
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-semibold">{x.title}</span>
                          <span className="block text-xs text-slate-500">
                            {[x.kind, x.phase, typeof c.belasting === "string" ? c.belasting : null].filter(Boolean).join(" · ")}
                          </span>
                          {typeof c.hoofddoel === "string" && c.hoofddoel && <span className="line-clamp-3 block text-sm text-slate-600">{c.hoofddoel}</span>}
                        </span>
                        {zones.length > 0 && <ZoneMap zones={zones} className="w-14 shrink-0" />}
                      </span>
                      {x.principles.length > 0 && <span className="mt-auto text-xs text-slate-500">{x.principles.join(" · ")}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
