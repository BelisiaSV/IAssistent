import Link from "next/link";
import { notFound } from "next/navigation";

import { type WeekDocument, WeekDocumentView } from "@/components/proposals/week-document-view";
import { messages } from "@/lib/messages";
import { opponentNames } from "@/lib/opponents/context";
import { shirtNames } from "@/lib/proposals/names";
import { weekPlanningToText } from "@/lib/proposals/text";
import type { WeekPlanningOutput } from "@/lib/proposals/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { isIsoDate, isoWeekday, longDate } from "@/lib/weeks/dates";
import { loadWeek, squadMas } from "@/lib/weeks/load";

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
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team } = await getTeamContext(teamId);

  const supabase = await createClient();
  const data = await loadWeek(supabase, team, weekStart);
  const runs = data.runs.filter((x) => x.kind === "week" && ["ready", "approved", "rejected"].includes(x.status));
  const run = runs.find((x) => String(x.version) === version) ?? runs.find((x) => x.status === "approved") ?? runs[0];
  if (!run) notFound();

  const outputs = Object.fromEntries(
    data.proposals.filter((x) => x.run_id === run.id && x.output).map((x) => [x.step ?? "", x.output]),
  ) as Record<string, unknown>;
  const doc = { pc: outputs.pc ?? null, tc: outputs.tc ?? null, ac: outputs.ac ?? null, tco: outputs.tco ?? null } as WeekDocument;
  const names = shirtNames(data.players);
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
      />
    </div>
  );
}
