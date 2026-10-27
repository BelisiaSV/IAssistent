import Link from "next/link";

import { TrainingSheet } from "@/components/proposals/training-sheet";
import { messages } from "@/lib/messages";
import { shortDate, weekdayName } from "@/lib/weeks/dates";
import { loadWeekDocument } from "@/lib/weeks/document";

import { ShareButtons } from "../copy-button";

const s = messages.sheet;

/** The trainings of the week, one portrait A4 sheet (or more) per training day. */
export default async function TrainingSheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ week?: string; dag?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { week: version, dag } = await searchParams;
  const { team, logoUrl, run, doc, exercises, names } = await loadWeekDocument(teamId, weekStart, version);
  const trainings = (doc.ac?.dagen ?? []).filter((d) => d.soort === "training");
  const shown = trainings.filter((d) => !dag || d.datum === dag);
  const base = `/teams/${team.id}/weeks/${weekStart}/print/days?week=${run.version}`;

  return (
    <div className="space-y-4">
      <style>{`@page { size: A4 portrait; margin: 0; }`}</style>
      <div className="space-y-2 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/teams/${team.id}/weeks/${weekStart}?week=${run.version}#week`} className="text-sm text-slate-600 hover:text-brand">
            ← {s.back}
          </Link>
          <ShareButtons text={shown.map((d) => `${weekdayName(d.datum)} ${shortDate(d.datum)}: ${d.titel}`).join("\n")} />
        </div>
        <nav className="flex flex-wrap gap-2 text-xs">
          {[{ href: base, label: s.allDays, active: !dag }, ...trainings.map((d) => ({ href: `${base}&dag=${d.datum}`, label: `${weekdayName(d.datum)} ${shortDate(d.datum)}`, active: dag === d.datum }))].map(
            (l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1 capitalize ring-1 ${l.active ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200"}`}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        {run.status !== "approved" && <p className="text-sm text-amber-700">{messages.poster.notApproved}</p>}
        <p className="text-xs text-slate-500">{s.hint}</p>
      </div>

      {shown.length === 0 && <p className="text-sm text-slate-600">{s.none}</p>}
      <div className="space-y-6 print:space-y-0">
        {shown.map((day) => (
          <TrainingSheet
            key={day.datum}
            day={day}
            accent={doc.tc?.trainingsaccenten.find((a) => a.datum === day.datum) ?? null}
            load={doc.pc?.dagen.find((d) => d.datum === day.datum) ?? null}
            drawings={doc.tco}
            setPieces={doc.tc?.standaardsituaties ?? []}
            library={exercises}
            names={names}
            team={{ clubName: team.club_name, teamName: team.name, primary: team.primary_color, logoUrl }}
          />
        ))}
      </div>
    </div>
  );
}
