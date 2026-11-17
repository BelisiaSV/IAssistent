import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { BANK_COLUMNS, bankScore, type BankRow, words } from "@/lib/exercise-bank/staff";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const m = messages.exerciseBank.coach;

/** The approved exercises of the platform's exercise bank, for every coach. */
export default async function ExerciseBankPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; fase?: string }> }) {
  const { q = "", type = "", fase = "" } = await searchParams;
  await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: own }] = await Promise.all([
    supabase.from("bank_exercises").select(BANK_COLUMNS).eq("status", "approved").order("number").limit(500),
    supabase.from("exercises").select("id, bank_number").not("bank_number", "is", null),
  ]);
  const all = (data ?? []) as BankRow[];
  const copied = new Map((own ?? []).map((x) => [x.bank_number!, x.id]));
  const types = [...new Set(all.map((x) => x.kind))].sort((a, b) => a.localeCompare(b, "nl"));
  const phases = [...new Set(all.flatMap((x) => (x.phase ? [x.phase] : [])))].sort((a, b) => a.localeCompare(b, "nl"));
  const wanted = words(q);
  const shown = all
    .filter((x) => (!type || x.kind === type) && (!fase || x.phase === fase))
    .map((x) => ({ x, score: wanted.length ? bankScore(x, wanted) : 1 }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.x);

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
          <form className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder={m.search}
              aria-label={m.search}
              className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <select name="type" defaultValue={type} aria-label={m.allTypes} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{m.allTypes}</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select name="fase" defaultValue={fase} aria-label={m.allPhases} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{m.allPhases}</option>
              {phases.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">{m.filter}</button>
          </form>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-600">{m.noResults}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((x) => {
                const goal = (x.content as { hoofddoel?: unknown } | null)?.hoofddoel;
                return (
                  <li key={x.number}>
                    <Link
                      href={`/exercises/bank/${x.number}`}
                      className="flex h-full flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono">{x.number}</span>
                        {copied.has(x.number) && <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">{m.inLibrary}</span>}
                      </span>
                      <span className="font-semibold">{x.title}</span>
                      <span className="text-xs text-slate-500">{[x.kind, x.phase].filter(Boolean).join(" · ")}</span>
                      {typeof goal === "string" && goal && <span className="line-clamp-3 text-sm text-slate-600">{goal}</span>}
                      {x.tags.length > 0 && <span className="mt-auto text-xs text-slate-500">{x.tags.map((t) => `#${t}`).join(" ")}</span>}
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
