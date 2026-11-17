import Link from "next/link";

import { EmptyState } from "@/components/card";
import { WeekDocumentView } from "@/components/proposals/week-document-view";
import { POSTER_HEIGHT, POSTER_WIDTH, WeekPoster } from "@/components/proposals/week-poster";
import { messages } from "@/lib/messages";
import { opponentNames } from "@/lib/opponents/context";
import { weekOverview } from "@/lib/proposals/overview";
import type { TacticalWeekOutput, WeekPlanningOutput } from "@/lib/proposals/types";
import { addDays, isIsoDate, isoWeekday, longDate, mondayOf, todayInBelgium } from "@/lib/weeks/dates";
import { findWeekDocument } from "@/lib/weeks/document";
import { squadMas } from "@/lib/weeks/load";

const m = messages.microcycle;

/**
 * Planning → Microcyclus: the week as planned with the staff (the approved
 * week document): first as the players see it, then per day with the
 * exercises. The week of today, or another one with ?week=.
 */
export default async function MicrocyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ teamId }, { week }] = await Promise.all([params, searchParams]);
  const thisWeek = mondayOf(todayInBelgium());
  const weekStart = week && isIsoDate(week) && isoWeekday(week) === 1 ? week : thisWeek;
  const { team, logoUrl, data, document } = await findWeekDocument(teamId, weekStart);
  const base = `/teams/${team.id}`;
  const link = "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{m.title(longDate(weekStart))}</h1>
        <nav className="flex flex-wrap gap-2">
          <Link href={`?week=${addDays(weekStart, -7)}`} className={link}>
            ← {m.previous}
          </Link>
          {weekStart !== thisWeek && (
            <Link href="?" className={link}>
              {m.today}
            </Link>
          )}
          <Link href={`?week=${addDays(weekStart, 7)}`} className={link}>
            {m.next} →
          </Link>
        </nav>
      </div>

      {!document ? (
        <EmptyState text={m.empty} href={`${base}/staff-room`} link={m.openStaffRoom} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {document.run.status !== "approved" && <p className="mr-2 text-sm text-amber-700">{m.notApproved}</p>}
            <Link href={`${base}/weeks/${weekStart}/print/overview?week=${document.run.version}`} className={link}>
              {m.poster}
            </Link>
            <Link href={`${base}/weeks/${weekStart}/print/days?week=${document.run.version}`} className={link}>
              {m.days}
            </Link>
            <Link href={`${base}/weeks/${weekStart}/print?week=${document.run.version}`} className={link}>
              {m.print}
            </Link>
            <Link href={`${base}/weeks/${weekStart}`} className={link}>
              {m.details}
            </Link>
          </div>

          {document.doc.ac && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{m.playersTitle}</h2>
              <div className="overflow-x-auto rounded-xl shadow-sm ring-1 ring-slate-200">
                <div style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}>
                  <WeekPoster
                    id="microcycle-poster"
                    overview={weekOverview(
                      document.doc.ac as WeekPlanningOutput,
                      (document.doc.tc as TacticalWeekOutput | null) ?? null,
                      document.matches,
                    )}
                    team={{ clubName: team.club_name, teamName: team.name, primary: team.primary_color, secondary: team.secondary_color, logoUrl }}
                    weekStart={weekStart}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{m.detailTitle}</h2>
            <WeekDocumentView
              doc={document.doc}
              names={document.names}
              opponentNames={opponentNames(data.opponentLineup)}
              masPlayers={squadMas(data, document.names)}
              exercises={document.exercises}
            />
          </section>
        </>
      )}
    </div>
  );
}
