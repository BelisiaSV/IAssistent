import Link from "next/link";

import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

const m = messages.exercises;
const PHASES = ["opwarming", "kern", "afsluiting"] as const;

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string; fase?: string }> }) {
  const { q = "", fase = "" } = await searchParams;
  await requireUser();
  const supabase = await createClient();
  let query = supabase
    .from("exercises")
    .select("id, title, phase, labels, min_players, max_players, duration_min, animation, video_path, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (PHASES.includes(fase as (typeof PHASES)[number])) query = query.eq("phase", fase as (typeof PHASES)[number]);
  const { data } = await query;
  const needle = q.trim().toLowerCase();
  const exercises = (data ?? []).filter(
    (x) => !needle || x.title.toLowerCase().includes(needle) || x.labels.some((l) => l.includes(needle)),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{m.title}</h1>
          <p className="text-sm text-slate-600">{m.intro}</p>
        </div>
        <Link href="/exercises/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          {m.new}
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={m.search}
          aria-label={m.search}
          className="min-w-56 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select name="fase" defaultValue={fase} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">{m.allPhases}</option>
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {m.phase[p]}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm">
          {m.search}
        </button>
      </form>

      {exercises.length === 0 ? (
        <p className="text-slate-600">{m.empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exercises.map((x) => (
            <li key={x.id}>
              <Link href={`/exercises/${x.id}`} className="block h-full space-y-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand">
                <p className="font-semibold">{x.title}</p>
                <p className="text-xs text-slate-500">
                  {[x.phase ? m.phase[x.phase] : null, m.players(x.min_players, x.max_players), x.duration_min ? m.minutes(x.duration_min) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {x.animation && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{m.hasAnimation}</span>}
                  {x.video_path && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-white">{m.hasVideo}</span>}
                  {x.labels.map((l) => (
                    <span key={l} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {l}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
