import Link from "next/link";

import { WeekDocumentView } from "@/components/proposals/week-document-view";
import { messages } from "@/lib/messages";
import { opponentNames } from "@/lib/opponents/context";
import { weekPlanningToText } from "@/lib/proposals/text";
import type { WeekPlanningOutput } from "@/lib/proposals/types";
import { longDate } from "@/lib/weeks/dates";
import { loadWeekDocument } from "@/lib/weeks/document";
import { squadMas } from "@/lib/weeks/load";

import { ShareButtons } from "./copy-button";

const m = messages.proposals.share;

/** The week document, ready to print or to paste as text. */
export default async function PrintWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { week: version } = await searchParams;
  const { team, data, run, doc, exercises, names } = await loadWeekDocument(teamId, weekStart, version);
  const title = `${team.club_name} – ${team.name} · ${messages.weeks.weekOf(longDate(weekStart))}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/teams/${team.id}/weeks/${weekStart}?week=${run.version}#week`} className="text-sm text-slate-600 hover:text-brand">
          ← {m.back}
        </Link>
        {doc.ac && <ShareButtons text={weekPlanningToText(doc.ac as WeekPlanningOutput, { title, names })} />}
      </div>
      {run.status !== "approved" && <p className="text-sm text-amber-700 print:hidden">{m.notApproved}</p>}
      <h2 className="text-xl font-semibold">
        {messages.staffRun.week.title} – {messages.weeks.weekOf(longDate(weekStart))}
      </h2>
      <WeekDocumentView
        doc={doc}
        names={names}
        opponentNames={opponentNames(data.opponentLineup)}
        masPlayers={squadMas(data, names)}
        exercises={exercises}
      />
    </div>
  );
}
