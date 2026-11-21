import Link from "next/link";

import { ButtonLink, EmptyState } from "@/components/card";
import { BankFilterForm } from "@/components/exercise-bank/bank-filters";
import { ZoneMap } from "@/components/exercise-bank/zone-map";
import { Alert } from "@/components/ui";
import {
  CLUB_EXERCISE_COLUMNS,
  type ClubExerciseRow,
  clubExerciseFilters,
  clubLevels,
  filterClubExercises,
} from "@/lib/clubs/exercises";
import { getClubContext } from "@/lib/clubs/load";
import { bankFilterOptions, bankZones } from "@/lib/exercise-bank/filters";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.exercises;
const categories = messages.ageCategories as Record<string, string>;
const select =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

/** The club's exercises with the bank's filters plus age, level and recommended; editors also see proposals and the archive. */
export default async function ClubExercisesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clubId } = await params;
  const query = await searchParams;
  const ctx = await getClubContext(clubId);
  const { supabase } = ctx;
  const moduleOn =
    ctx.active && (ctx.subscription?.modules ?? []).includes("exercises");
  const editor = ctx.roles.some(
    (r) => r === "owner" || r === "admin" || r === "technical_director",
  );
  const status =
    typeof query.status === "string" &&
    ["proposed", "archived"].includes(query.status)
      ? query.status
      : "approved";
  const filters = clubExerciseFilters(query);

  const [{ data }, { data: picks }] = await Promise.all([
    supabase
      .from("club_exercises")
      .select(CLUB_EXERCISE_COLUMNS)
      .eq("club_id", clubId)
      .eq("status", status)
      .order("number")
      .limit(500),
    supabase
      .from("club_bank_picks")
      .select(
        "bank_number, recommended, bank_exercises(number, title, kind, phase)",
      )
      .eq("club_id", clubId),
  ]);
  const all = (data ?? []) as ClubExerciseRow[];
  const shown = filterClubExercises(all, filters);
  const tabs = editor
    ? ["approved", "proposed", "archived"]
    : ["approved", "proposed"];

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">{m.intro}</p>
      {!moduleOn && <Alert tone="error">{m.moduleOff}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t}
              href={
                t === "approved"
                  ? `/clubs/${clubId}/exercises`
                  : `/clubs/${clubId}/exercises?status=${t}`
              }
              aria-current={t === status ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-medium ${t === status ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {m.tabs[t]}
            </Link>
          ))}
        </nav>
        {moduleOn && (
          <ButtonLink href={`/clubs/${clubId}/exercises/new`}>
            {m.newExercise}
          </ButtonLink>
        )}
      </div>

      {all.length === 0 ? (
        <EmptyState text={m.empty} />
      ) : (
        <>
          <BankFilterForm
            filters={filters}
            options={bankFilterOptions(all)}
            hidden={status === "approved" ? {} : { status }}
            extra={
              <>
                <select
                  name="leeftijd"
                  defaultValue={filters.leeftijd}
                  aria-label={m.allAges}
                  className={select}
                >
                  <option value="">{m.allAges}</option>
                  {AGE_CATEGORIES.map((a) => (
                    <option key={a} value={a}>
                      {categories[a] ?? a}
                    </option>
                  ))}
                </select>
                <select
                  name="niveau"
                  defaultValue={filters.niveau}
                  aria-label={m.allLevels}
                  className={select}
                >
                  <option value="">{m.allLevels}</option>
                  {clubLevels(all).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="aanbevolen"
                    value="1"
                    defaultChecked={!!filters.aanbevolen}
                    className="accent-brand"
                  />
                  {m.onlyRecommended}
                </label>
              </>
            }
          />
          <p className="text-sm text-slate-500">
            {m.count(shown.length, all.length)}
          </p>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-600">{m.noResults}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((x) => {
                const c = (x.content ?? {}) as { hoofddoel?: unknown };
                const zones = bankZones(x);
                return (
                  <li key={x.id}>
                    <Link
                      href={`/clubs/${clubId}/exercises/${x.id}`}
                      className="flex h-full flex-col gap-2 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono">{x.number}</span>
                        {x.recommended && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                            {m.recommended}
                          </span>
                        )}
                      </span>
                      <span className="flex gap-3">
                        <span className="min-w-0 flex-1 space-y-1">
                          <span className="block font-semibold">{x.title}</span>
                          <span className="block text-xs text-slate-500">
                            {[
                              x.kind,
                              x.phase,
                              x.level,
                              x.age_categories
                                .map((a) => categories[a] ?? a)
                                .join(", "),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {typeof c.hoofddoel === "string" && c.hoofddoel && (
                            <span className="line-clamp-3 block text-sm text-slate-600">
                              {c.hoofddoel}
                            </span>
                          )}
                        </span>
                        {zones.length > 0 && (
                          <ZoneMap zones={zones} className="w-14 shrink-0" />
                        )}
                      </span>
                      <span className="mt-auto text-xs text-slate-500">
                        {m.origin[x.origin]}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {status === "approved" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{m.picksTitle}</h2>
            <Link
              href="/exercises/bank"
              className="text-sm text-brand hover:underline"
            >
              {m.openBank} →
            </Link>
          </div>
          {(picks ?? []).length ? (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[...(picks ?? [])]
                .sort((a, b) => Number(b.recommended) - Number(a.recommended))
                .map((p) => (
                  <li key={p.bank_number}>
                    <Link
                      href={`/exercises/bank/${p.bank_number}`}
                      className="flex h-full flex-col gap-1 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-brand"
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono">{p.bank_number}</span>
                        {p.recommended && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                            {m.recommended}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold">
                        {p.bank_exercises?.title ?? p.bank_number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[p.bank_exercises?.kind, p.bank_exercises?.phase]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">{m.picksEmpty}</p>
          )}
        </section>
      )}
    </div>
  );
}
