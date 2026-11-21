import Link from "next/link";

import { Card, CardHeader, EmptyState, StatTile } from "@/components/card";
import { QualityBadge } from "@/components/quality/quality-review";
import { loadClubDashboard } from "@/lib/clubs/dashboard";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { qualityLabels } from "@/lib/quality/labels";
import { longDate } from "@/lib/weeks/dates";

const m = messages.club.dashboard;
const roles = messages.clubAdmin.teamRoles;
const categories = messages.ageCategories as Record<string, string>;

/** The club's overview: licences, teams with their staff and activity, attention points and recent work. */
export default async function ClubDashboardPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  const data = await loadClubDashboard(ctx);
  const active = data.teams.filter((t) => !t.archived);
  const modules = ctx.subscription?.modules ?? [];
  const labels = qualityLabels();
  // The lowest verdict of the Training Quality Engine asks for attention.
  const lowest = labelsLowest(labels);

  const attention = [
    ...active
      .filter((t) => !t.staff.some((s) => s.role === "head_coach"))
      .map((t) => m.noHeadCoach(t.name)),
    ...active
      .filter(
        (t) => t.staff.some((s) => s.role === "head_coach") && !t.weekApproved,
      )
      .map((t) => m.noWeek(t.name)),
    ...active
      .filter((t) => t.quality?.verdict && t.quality.verdict === lowest)
      .map((t) => m.lowQuality(t.name)),
    ...(data.pendingLinks ? [m.pendingLinks(data.pendingLinks)] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ctx.canManage && data.seatsUsed !== null && (
          <StatTile
            label={m.licenses}
            value={m.licensesValue(
              data.seatsUsed,
              ctx.subscription?.license_seats ?? 0,
            )}
          />
        )}
        <StatTile label={m.teams} value={active.length} />
        <StatTile label={m.trainers} value={data.trainers} />
        <StatTile
          label={m.modules}
          value={
            modules.length
              ? modules.map((c) => messages.clubAdmin.modules[c]).join(", ")
              : m.noModules
          }
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title={m.teamsTitle} />
          <div className="overflow-x-auto px-5 pb-4">
            {data.teams.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{m.columns.team}</th>
                    <th className="py-2 pr-3 font-medium">
                      {m.columns.category}
                    </th>
                    <th className="py-2 pr-3 font-medium">{m.columns.staff}</th>
                    <th className="py-2 pr-3 font-medium">{m.columns.week}</th>
                    <th className="py-2 pr-3 font-medium">
                      {m.columns.evaluation}
                    </th>
                    <th className="py-2 font-medium">{m.columns.sessions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.teams.map((t) => (
                    <tr
                      key={t.id}
                      className={t.archived ? "text-slate-400" : ""}
                    >
                      <td className="py-2 pr-3 font-medium">
                        <Link
                          href={`/teams/${t.id}`}
                          className="text-brand hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        {categories[t.ageCategory] ?? t.ageCategory}
                      </td>
                      <td className="py-2 pr-3">
                        {t.staff.length
                          ? t.staff
                              .map(
                                (s) => `${s.name} (${roles[s.role] ?? s.role})`,
                              )
                              .join(", ")
                          : m.noStaff}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.weekApproved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                        >
                          {t.weekApproved ? m.weekApproved : m.weekOpen}
                        </span>
                        {t.quality && (
                          <span
                            className="ml-1.5"
                            title={
                              ((t.quality.output as { verbeterpunten?: { punt: string }[] } | null)?.verbeterpunten ?? [])
                                .map((v) => `• ${v.punt}`)
                                .join("\n") || undefined
                            }
                          >
                            <QualityBadge review={t.quality} labels={labels} />
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {t.lastEvaluation ? longDate(t.lastEvaluation) : "—"}
                      </td>
                      <td className="py-2 tabular-nums">{t.sessions28}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState text={m.noTeams} />
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={m.attention} />
            <div className="px-5 pb-4 text-sm">
              {attention.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {attention.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">{m.noAttention}</p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title={m.recent} />
            <div className="px-5 pb-4 text-sm">
              {data.recent.length ? (
                <ul className="space-y-1.5">
                  {data.recent.map((r) => (
                    <li key={`${r.kind}-${r.teamName}-${r.date}`}>
                      {r.kind === "week"
                        ? m.recentWeek(r.teamName, longDate(r.date))
                        : m.recentEvaluation(r.teamName, longDate(r.date))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">{m.noRecent}</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** The verdict code of the lowest band (e.g. "aandacht"). */
function labelsLowest(labels: { verdicts: Record<string, string> }): string | null {
  const codes = Object.keys(labels.verdicts);
  return codes[codes.length - 1] ?? null;
}
