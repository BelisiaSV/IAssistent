import Link from "next/link";
import { notFound } from "next/navigation";

import { Modal } from "@/components/admin/modal";
import { Badge, Row, Rows } from "@/components/admin/rows";
import { ConfirmButton } from "@/components/clubs/forms";
import { QualityBadge } from "@/components/quality/quality-review";
import { getClubContext } from "@/lib/clubs/load";
import { deletePeriod } from "@/lib/clubs/planning-actions";
import { type ClubPlanning, loadClubPlanning, type PlanningTeam } from "@/lib/clubs/planning";
import { periodsBetween } from "@/lib/clubs/periods";
import { messages } from "@/lib/messages";
import { qualityLabels } from "@/lib/quality/labels";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";
import { addDays, isIsoDate, isoWeek, mondayOf, shortDate, todayInBelgium } from "@/lib/weeks/dates";

import { PeriodForm } from "./period-form";

const m = messages.club.planning;
const categories = messages.ageCategories as Record<string, string>;
const VIEWS = ["week", "month", "season"] as const;
type View = (typeof VIEWS)[number];
const weekday = new Intl.DateTimeFormat("nl-BE", { weekday: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric", timeZone: "UTC" });

/** The Mondays of the weeks that start in a month (YYYY-MM). */
function mondaysOfMonth(month: string): string[] {
  const first = `${month}-01`;
  let monday = mondayOf(first);
  if (monday < first) monday = addDays(monday, 7);
  const out: string[] = [];
  for (let w = monday; w.slice(0, 7) === month; w = addDays(w, 7)) out.push(w);
  return out;
}

function shiftMonth(month: string, by: number): string {
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Club planning (module "planning"): every team per week or month, and the club's periods with training goals. */
export default async function ClubPlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ view?: string; week?: string; month?: string }>;
}) {
  const { clubId } = await params;
  const query = await searchParams;
  const ctx = await getClubContext(clubId);
  if (!(ctx.subscription?.modules ?? []).includes("planning")) notFound();
  const view: View = VIEWS.find((v) => v === query.view) ?? "week";
  const today = todayInBelgium();
  const week = query.week && isIsoDate(query.week) ? mondayOf(query.week) : mondayOf(today);
  const month = query.month && /^\d{4}-\d{2}$/.test(query.month) ? query.month : today.slice(0, 7);
  const mondays = view === "month" ? mondaysOfMonth(month) : [week];
  const data = await loadClubPlanning(ctx, mondays[0]!, mondays[mondays.length - 1]!);
  const editor = ctx.roles.some((r) => r === "owner" || r === "admin" || r === "technical_director");
  const base = `/clubs/${clubId}/planning`;

  const nav =
    view === "week"
      ? {
          label: m.weekLabel(isoWeek(week), shortDate(week), shortDate(addDays(week, 6))),
          prev: `${base}?view=week&week=${addDays(week, -7)}`,
          next: `${base}?view=week&week=${addDays(week, 7)}`,
        }
      : view === "month"
        ? {
            label: monthName.format(new Date(`${month}-01T00:00:00Z`)),
            prev: `${base}?view=month&month=${shiftMonth(month, -1)}`,
            next: `${base}?view=month&month=${shiftMonth(month, 1)}`,
          }
        : null;
  const rangeEnd = addDays(mondays[mondays.length - 1]!, 6);
  const current = periodsBetween(data.periods, mondays[0]!, rangeEnd);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex gap-1">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={`${base}?view=${v}`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${v === view ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
            >
              {m.views[v]}
            </Link>
          ))}
        </nav>
        {nav && (
          <div className="flex items-center gap-2 text-sm">
            <Link href={nav.prev} className="rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">
              ← {m.previous}
            </Link>
            <span className="font-medium capitalize">{nav.label}</span>
            <Link href={nav.next} className="rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50">
              {m.next} →
            </Link>
            <Link href={`${base}?view=${view}`} className="text-xs text-brand hover:underline">
              {m.today}
            </Link>
          </div>
        )}
      </div>

      {view !== "season" && current.length > 0 && (
        <p className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-800">{m.currentPeriod}:</span>{" "}
          {current
            .map(
              (p) =>
                `${p.title} (${p.age_categories.length ? p.age_categories.map((c) => categories[c] ?? c).join(", ") : m.allCategories})${p.goals.length ? ` — ${p.goals.join(" · ")}` : ""}`,
            )
            .join(" | ")}
        </p>
      )}

      {view === "week" && <WeekView data={data} weekStart={week} />}
      {view === "month" && <MonthView data={data} />}
      {view === "season" && <SeasonView clubId={clubId} data={data} editor={editor} today={today} />}
    </div>
  );
}

/** Teams grouped by age category, in the order of the categories. */
function byCategory(teams: PlanningTeam[]) {
  return AGE_CATEGORIES.map((c) => ({ category: c, teams: teams.filter((t) => t.ageCategory === c) })).filter((g) => g.teams.length);
}

function WeekView({ data, weekStart }: { data: ClubPlanning; weekStart: string }) {
  const labels = qualityLabels();
  if (!data.teams.length) return <p className="text-sm text-slate-500">{m.noTeams}</p>;
  return (
    <div className="space-y-4">
      {byCategory(data.teams).map((group) => (
        <Rows key={group.category} title={categories[group.category]}>
          {group.teams.map((t) => {
            const w = t.weeks[0]!;
            return (
              <Row
                key={t.id}
                meta={
                  <>
                    <span className="flex gap-0.5">
                      {t.days.map((d) => (
                        <span
                          key={d.date}
                          title={[d.md ? `${d.md.code} · ${d.md.naam}` : null, d.training ? `${m.training} ${d.training.start}` : null, d.match ? m.match : null, d.done ? m.done : null].filter(Boolean).join(" · ") || undefined}
                          className={`flex w-9 flex-col items-center rounded py-0.5 text-[10px] leading-tight ring-1 ${
                            d.match
                              ? "bg-red-100 text-red-800 ring-red-200"
                              : d.training
                                ? d.done
                                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                  : "bg-sky-100 text-sky-800 ring-sky-200"
                                : "text-slate-400 ring-slate-100"
                          }`}
                        >
                          <span className="capitalize">{weekday.format(new Date(`${d.date}T00:00:00Z`)).slice(0, 2)}</span>
                          <span className="font-semibold">{d.match ? "W" : d.training ? "T" : "·"}</span>
                          <span>{d.md?.code ?? ""}</span>
                        </span>
                      ))}
                    </span>
                    {w.hasInput ? (
                      <span className="tabular-nums">
                        {m.trainings(w.done, w.trainings)} · {m.minutes(w.minutes)}
                      </span>
                    ) : (
                      <span>{m.noInput}</span>
                    )}
                    <Badge tone={w.approved ? "green" : "amber"}>{w.approved ? m.approved : m.open}</Badge>
                    {w.quality && <QualityBadge review={w.quality} labels={labels} />}
                  </>
                }
                actions={
                  <Link href={`/teams/${t.id}/weeks/${weekStart}`} className="text-xs font-medium text-brand hover:underline">
                    {m.toWeek} →
                  </Link>
                }
              >
                {t.name}
                <span className="block text-xs font-normal text-slate-500">{t.headCoach ? m.headCoach(t.headCoach) : m.noHeadCoach}</span>
              </Row>
            );
          })}
        </Rows>
      ))}
      <p className="text-xs text-slate-500">{m.legend}</p>
    </div>
  );
}

function MonthView({ data }: { data: ClubPlanning }) {
  if (!data.teams.length) return <p className="text-sm text-slate-500">{m.noTeams}</p>;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium" />
              {data.weekStarts.map((w) => (
                <th key={w} className="px-2 py-2 text-center font-medium">
                  W{isoWeek(w)}
                  <span className="block font-normal">{shortDate(w)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {byCategory(data.teams).flatMap((group) => [
              <tr key={group.category}>
                <td colSpan={data.weekStarts.length + 1} className="bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {categories[group.category]}
                </td>
              </tr>,
              ...group.teams.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-1.5 font-medium">{t.name}</td>
                  {t.weeks.map((w) => (
                    <td key={w.weekStart} className="px-2 py-1.5 text-center">
                      <Link
                        href={`/teams/${t.id}/weeks/${w.weekStart}`}
                        title={w.quality?.verdict ?? undefined}
                        className={`inline-block min-w-12 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                          !w.hasInput ? "bg-slate-100 text-slate-500" : w.approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {w.hasInput ? `${w.done}/${w.trainings}` : "—"}
                      </Link>
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{m.monthLegend}</p>
    </div>
  );
}

function SeasonView({ clubId, data, editor, today }: { clubId: string; data: ClubPlanning; editor: boolean; today: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-700">{m.periods}</h2>
          <p className="text-xs text-slate-500">{m.periodsIntro}</p>
        </div>
        {editor && (
          <Modal label={m.newPeriod} plus wide>
            <PeriodForm clubId={clubId} period={null} />
          </Modal>
        )}
      </div>
      <Rows empty={m.noPeriods}>
        {data.periods.map((p) => {
          const now = p.starts_on <= today && p.ends_on >= today;
          return (
            <Row
              key={p.id}
              meta={
                <>
                  <span className="tabular-nums">
                    {shortDate(p.starts_on)} – {shortDate(p.ends_on)}
                  </span>
                  <span>{p.age_categories.length ? p.age_categories.map((c) => categories[c] ?? c).join(", ") : m.allCategories}</span>
                  {now && <Badge tone="green">{m.currentPeriod}</Badge>}
                </>
              }
              actions={
                editor && (
                  <>
                    <Modal label={m.edit} title={p.title} wide>
                      <PeriodForm clubId={clubId} period={p} />
                    </Modal>
                    <form action={deletePeriod}>
                      <input type="hidden" name="clubId" value={clubId} />
                      <input type="hidden" name="periodId" value={p.id} />
                      <ConfirmButton label={m.delete} confirmText={m.deleteConfirm} />
                    </form>
                  </>
                )
              }
            >
              {p.title}
              {(p.goals.length > 0 || p.focus) && (
                <span className="block text-xs font-normal text-slate-600">
                  {p.goals.join(" · ")}
                  {p.focus ? `${p.goals.length ? " — " : ""}${p.focus}` : ""}
                </span>
              )}
            </Row>
          );
        })}
      </Rows>
    </div>
  );
}
