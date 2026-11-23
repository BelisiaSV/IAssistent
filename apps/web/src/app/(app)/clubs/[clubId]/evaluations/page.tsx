import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Row, Rows } from "@/components/admin/rows";
import { QualityBadge } from "@/components/quality/quality-review";
import { getClubContext } from "@/lib/clubs/load";
import { loadDevelopment, qualityPoints, recurring } from "@/lib/development/load";
import { messages } from "@/lib/messages";
import { qualityLabels } from "@/lib/quality/labels";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";
import { addDays, longDate, shortDate, todayInBelgium } from "@/lib/weeks/dates";

const m = messages.club.evaluations;
const categories = messages.ageCategories as Record<string, string>;
const one = (n: number) => n.toLocaleString("nl-BE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Club module "evaluations": every team in a period — trainings, evaluations, quality, goals and what comes back. */
export default async function ClubEvaluationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { clubId } = await params;
  const { periode } = await searchParams;
  const ctx = await getClubContext(clubId);
  if (!(ctx.subscription?.modules ?? []).includes("evaluations")) notFound();
  const { supabase, club } = ctx;
  const today = todayInBelgium();
  const seasonStart = `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 7 ? 1 : 0)}-07-01`;

  const [{ data: teams }, { data: periods }] = await Promise.all([
    supabase.from("teams").select("id, name, age_category").eq("club_id", club.id).is("archived_at", null).order("name"),
    supabase.from("club_periods").select("id, title, starts_on, ends_on").eq("club_id", club.id).order("starts_on"),
  ]);
  const options = [
    { id: "4w", label: m.last4, from: addDays(today, -27), to: today },
    { id: "seizoen", label: m.season, from: seasonStart, to: today },
    ...(periods ?? []).map((p) => ({ id: p.id, label: `${p.title} (${shortDate(p.starts_on)} – ${shortDate(p.ends_on)})`, from: p.starts_on, to: p.ends_on < today ? p.ends_on : today })),
  ];
  const selected = options.find((o) => o.id === periode) ?? options[0]!;
  const data = await loadDevelopment(supabase, (teams ?? []).map((t) => t.id), selected.from, selected.to);
  const labels = qualityLabels();

  const rows = (teams ?? []).map((t) => {
    const trainings = (data?.trainings ?? []).filter((x) => x.teamId === t.id);
    const evaluations = (data?.evaluations ?? []).filter((x) => x.team_id === t.id);
    const goals = (data?.goals ?? []).filter((g) => g.team_id === t.id && g.status !== "dropped");
    const reviews = (data?.reviews ?? []).filter((r) => r.teamId === t.id);
    const quality = avg(reviews.map((r) => Number(r.average)));
    return {
      team: t,
      planned: trainings.length,
      done: trainings.filter((x) => x.done).length,
      evaluated: evaluations.length,
      rating: avg(evaluations.flatMap((e) => (e.rating ? [e.rating] : []))),
      goals,
      quality,
      latestReview: reviews[0] ?? null,
      points: recurring(evaluations).slice(0, 3),
    };
  });
  const clubPoints = data ? recurring(data.evaluations) : [];
  const clubQuality = data ? qualityPoints(data.reviews.map((r) => r.output)) : [];
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-xs text-slate-500">{m.intro}</p>
        <form className="flex items-center gap-2 text-sm">
          <label htmlFor="periode" className="text-xs font-medium text-slate-600">
            {m.period}
          </label>
          <select id="periode" name="periode" defaultValue={selected.id} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
            {m.show}
          </button>
        </form>
      </div>
      <p className="text-xs text-slate-500">
        {longDate(selected.from)} – {longDate(selected.to)}
      </p>

      {!rows.length && <p className="text-sm text-slate-500">{m.noTeams}</p>}
      {AGE_CATEGORIES.map((c) => ({ c, list: rows.filter((r) => r.team.age_category === c) }))
        .filter((g) => g.list.length)
        .map(({ c, list }) => (
          <Rows key={c} title={categories[c]}>
            {list.map((r) => {
              const achieved = r.goals.filter((g) => g.status === "achieved").length;
              const progress = Math.round(avg(r.goals.map((g) => g.progress)) ?? 0);
              return (
                <Row
                  key={r.team.id}
                  meta={
                    <>
                      <span className="tabular-nums">{m.trainings(r.done, r.planned)}</span>
                      <span className="tabular-nums">{m.evaluated(r.evaluated)}</span>
                      {r.rating !== null && <span className="tabular-nums">{m.rating(one(r.rating))}</span>}
                      {r.latestReview && r.quality !== null && (
                        <QualityBadge review={{ ...r.latestReview, average: Math.round(r.quality * 10) / 10 }} labels={labels} />
                      )}
                      <span className="tabular-nums">{r.goals.length ? m.goals(achieved, r.goals.length, progress) : m.noGoals}</span>
                      {r.points.map((p) => (
                        <Badge key={p.code} tone="amber">
                          {p.naam} · {p.aantal}×
                        </Badge>
                      ))}
                    </>
                  }
                  actions={
                    <Link href={`/teams/${r.team.id}/development`} className="text-xs font-medium text-brand hover:underline">
                      {m.open} →
                    </Link>
                  }
                >
                  {r.team.name}
                </Row>
              );
            })}
          </Rows>
        ))}

      <Rows title={m.recurring}>
        <li className="flex flex-wrap items-center gap-1.5 px-3 py-2 text-sm">
          {clubPoints.length === 0 && clubQuality.length === 0 && <span className="text-xs text-slate-500">{m.recurringNone}</span>}
          {clubPoints.map((p) => (
            <Badge key={p.code} tone="amber">
              {p.naam} · {p.aantal}×
            </Badge>
          ))}
          {clubQuality.map((p) => (
            <Badge key={p.code} tone="sky">
              {p.naam} · {p.aantal}×
            </Badge>
          ))}
        </li>
      </Rows>

      <Rows title={m.reviews} empty={m.reviewsNone}>
        {(data?.reviews ?? [])
          .slice()
          .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
          .map((r) => {
            const first = (r.output as { verbeterpunten?: { punt: string }[] } | null)?.verbeterpunten?.[0]?.punt;
            return (
              <Row
                key={r.run_id}
                meta={
                  <>
                    <span>{m.week(shortDate(r.weekStart))}</span>
                    <QualityBadge review={r} labels={labels} />
                  </>
                }
                actions={
                  <Link href={`/teams/${r.teamId}/weeks/${r.weekStart}#week`} className="text-xs font-medium text-brand hover:underline">
                    {m.toWeek} →
                  </Link>
                }
              >
                {teamName.get(r.teamId) ?? "—"}
                {first && <span className="block text-xs font-normal text-slate-600">{first}</span>}
              </Row>
            );
          })}
      </Rows>
    </div>
  );
}
