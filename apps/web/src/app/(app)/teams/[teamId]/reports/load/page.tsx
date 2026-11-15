import Link from "next/link";

import { Card, CardHeader, EmptyState } from "@/components/card";
import { LoadChart } from "@/components/proposals/load-chart";
import { messages } from "@/lib/messages";
import { periodizationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, mondayOf, shortDate, todayInBelgium } from "@/lib/weeks/dates";
import { loadWeek } from "@/lib/weeks/load";

const m = messages.reportsPage.load;

/** Belasting per week: planned vs. actual AU of the last weeks, this week included. */
export default async function WeeklyLoadPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const supabase = await createClient();
  // History runs up to the week before the given one: start from next week so this week is in.
  const data = await loadWeek(supabase, team, addDays(mondayOf(todayInBelgium()), 7));
  const weeks = data.history;
  const typeName = (code: string | null) => periodizationCatalog.weektypes.find((w) => w.code === code)?.naam ?? "–";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.hint}</p>
      </div>
      {!weeks.length ? (
        <EmptyState text={m.none} href={`/teams/${team.id}/weeks`} link={messages.nav.microcycle} />
      ) : (
        <>
          <LoadChart
            title={m.chartTitle}
            days={weeks.map((w) => ({ date: w.week_van, label: shortDate(w.week_van), planned: w.gepland_au, actual: w.werkelijk_au }))}
          />
          <Card>
            <CardHeader title={m.title} />
            <div className="overflow-x-auto px-5 pb-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{m.week}</th>
                    <th className="py-2 pr-3 font-medium">{m.type}</th>
                    <th className="py-2 pr-3 text-right font-medium">{m.planned}</th>
                    <th className="py-2 text-right font-medium">{m.actual}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {weeks.toReversed().map((w) => (
                    <tr key={w.week_van}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Link href={`/teams/${team.id}/weeks/${w.week_van}`} className="text-brand hover:underline">
                          {shortDate(w.week_van)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{typeName(w.weektype)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{w.gepland_au ?? "–"}</td>
                      <td className="py-2 text-right tabular-nums">{w.werkelijk_au ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
