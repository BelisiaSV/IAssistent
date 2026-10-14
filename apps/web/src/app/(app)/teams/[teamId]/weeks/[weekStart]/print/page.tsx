import Link from "next/link";
import { notFound } from "next/navigation";

import { DrawingsView } from "@/components/proposals/drawings-view";
import { WeekPlanningView } from "@/components/proposals/week-planning-view";
import { messages } from "@/lib/messages";
import { shirtNames } from "@/lib/proposals/names";
import { weekPlanningToText } from "@/lib/proposals/text";
import type { DrawingsOutput, WeekPlanningOutput } from "@/lib/proposals/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { isIsoDate, isoWeekday, longDate } from "@/lib/weeks/dates";

import { ShareButtons } from "./copy-button";

const m = messages.proposals.share;

export default async function PrintWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ v?: string; drawings?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { v, drawings: drawingsVersion } = await searchParams;
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team } = await getTeamContext(teamId);

  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("id")
    .eq("team_id", team.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) notFound();

  const [{ data: proposals }, { data: drawingProposals }, { data: players }] = await Promise.all([
    supabase
      .from("staff_proposals")
      .select("version, status, output")
      .eq("week_plan_id", week.id)
      .eq("role", "assistant-coach")
      .eq("task", "default")
      .not("output", "is", null)
      .order("version", { ascending: false }),
    supabase
      .from("staff_proposals")
      .select("version, status, output")
      .eq("week_plan_id", week.id)
      .eq("role", "tactical-coach")
      .eq("task", "oefenstof")
      .not("output", "is", null)
      .order("version", { ascending: false }),
    supabase.from("players").select("shirt_number, first_name, last_name, archived_at").eq("team_id", team.id),
  ]);
  const list = proposals ?? [];
  const proposal =
    list.find((p) => String(p.version) === v) ?? list.find((p) => p.status === "approved") ?? list[0];
  if (!proposal?.output) notFound();

  // The drawn exercises go along: the requested version, else the approved one.
  const drawingList = drawingProposals ?? [];
  const drawings = (
    drawingList.find((p) => String(p.version) === drawingsVersion) ?? drawingList.find((p) => p.status === "approved")
  )?.output as unknown as DrawingsOutput | undefined;

  const output = proposal.output as unknown as WeekPlanningOutput;
  const names = shirtNames(players ?? []);
  const title = `${team.club_name} – ${team.name} · ${messages.weeks.weekOf(longDate(weekStart))}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/teams/${team.id}/weeks/${weekStart}?ac=${proposal.version}#ac`} className="text-sm text-slate-600 hover:text-brand">
          ← {m.back}
        </Link>
        <ShareButtons text={weekPlanningToText(output, { title, names })} />
      </div>
      {proposal.status !== "approved" && <p className="text-sm text-amber-700 print:hidden">{m.notApproved}</p>}
      <h2 className="text-xl font-semibold">
        {m.title} – {messages.weeks.weekOf(longDate(weekStart))}
      </h2>
      <WeekPlanningView output={output} names={names} />
      {drawings && (
        <section className="space-y-3 break-before-page">
          <h2 className="text-xl font-semibold">{messages.drawings.title}</h2>
          <DrawingsView output={drawings} names={names} />
        </section>
      )}
    </div>
  );
}
