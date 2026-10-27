import Link from "next/link";

import { PosterExport } from "@/components/proposals/poster-export";
import { POSTER_HEIGHT, POSTER_WIDTH, WeekPoster } from "@/components/proposals/week-poster";
import { messages } from "@/lib/messages";
import { weekOverview } from "@/lib/proposals/overview";
import type { TacticalWeekOutput, WeekPlanningOutput } from "@/lib/proposals/types";
import { loadWeekDocument } from "@/lib/weeks/document";

const p = messages.poster;
const POSTER_ID = "week-poster";

/** The week overview for the players: one landscape page, also as a PNG. */
export default async function WeekOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { week: version } = await searchParams;
  const { team, logoUrl, run, doc, matches } = await loadWeekDocument(teamId, weekStart, version);
  const back = `/teams/${team.id}/weeks/${weekStart}?week=${run.version}#week`;

  return (
    <div className="space-y-4">
      {/* One landscape page; the poster is sized for A4 landscape. */}
      <style>{`@page { size: A4 landscape; margin: 0; }`}</style>
      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={back} className="text-sm text-slate-600 hover:text-brand">
            ← {p.back}
          </Link>
          {doc.ac && <PosterExport targetId={POSTER_ID} fileName={`weekoverzicht-${team.name}-${weekStart}.png`.replace(/\s+/g, "-").toLowerCase()} />}
        </div>
        {run.status !== "approved" && <p className="text-sm text-amber-700">{p.notApproved}</p>}
        <p className="text-xs text-slate-500">{p.hint}</p>
      </div>
      {doc.ac ? (
        <div className="overflow-x-auto rounded-xl shadow-sm ring-1 ring-slate-200 print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
          <div style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
            <WeekPoster
              id={POSTER_ID}
              overview={weekOverview(doc.ac as WeekPlanningOutput, (doc.tc as TacticalWeekOutput | null) ?? null, matches)}
              team={{ clubName: team.club_name, teamName: team.name, primary: team.primary_color, secondary: team.secondary_color, logoUrl }}
              weekStart={weekStart}
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">{messages.staffRun.missing(messages.staffRun.stepNames.ac!)}</p>
      )}
    </div>
  );
}
