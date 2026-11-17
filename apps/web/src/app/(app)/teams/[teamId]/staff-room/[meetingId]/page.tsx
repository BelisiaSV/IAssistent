import type { Json } from "@iassistent/db";
import type { MeetingWeekPlan } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EmptyState } from "@/components/card";
import { BankMedia } from "@/components/exercise-bank/bank-media";
import { AnimatedDrawing } from "@/components/proposals/animated-drawing";
import { OverviewCard } from "@/components/staff/meeting-feed";
import { loadWeekExercises } from "@/lib/exercises/week";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { currentOverview, MEETING_COLUMNS, toMeetingView, TURN_COLUMNS } from "@/lib/staff-room/meetings";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { longDate, shortDate } from "@/lib/weeks/dates";

const m = messages.staffRoom.meeting;
const p = m.page;

/** An exercise of the week plan with the days it is used on. */
interface PlannedExercise {
  key: string;
  ownId: string | null;
  bankNumber: string | null;
  name: string;
  coaching: string[];
  days: string[];
}

function plannedExercises(plan: MeetingWeekPlan): PlannedExercise[] {
  const byKey = new Map<string, PlannedExercise>();
  for (const day of plan.dagen) {
    for (const part of day.onderdelen) {
      const key = part.oefening_id ? `own:${part.oefening_id}` : part.bank_nummer ? `bank:${part.bank_nummer}` : null;
      if (!key) continue;
      const entry = byKey.get(key) ?? {
        key,
        ownId: part.oefening_id,
        bankNumber: part.oefening_id ? null : part.bank_nummer,
        name: part.naam,
        coaching: part.coachingspunten,
        days: [],
      };
      entry.days.push(`${day.weekdag} ${shortDate(day.datum)}`);
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()];
}

/**
 * The joint overview of a staff meeting on its own page (opened in a new
 * tab): the overview, the week plan for coach and players and every exercise
 * of the week with its picture.
 */
export default async function MeetingOverviewPage({ params }: { params: Promise<{ teamId: string; meetingId: string }> }) {
  const { teamId, meetingId } = await params;
  if (!z.uuid().safeParse(meetingId).success) notFound();
  const { team, logoUrl } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: meeting }, { data: turns }, { data: players }] = await Promise.all([
    supabase.from("staff_meetings").select(MEETING_COLUMNS).eq("id", meetingId).eq("team_id", team.id).maybeSingle(),
    supabase.from("staff_meeting_turns").select(TURN_COLUMNS).eq("meeting_id", meetingId),
    supabase.from("players").select("shirt_number, first_name, last_name").eq("team_id", team.id).is("archived_at", null),
  ]);
  if (!meeting) notFound();
  const view = toMeetingView(meeting, turns ?? []);
  const overview = currentOverview(view);
  const names = Object.fromEntries((players ?? []).flatMap((x) => (x.shirt_number === null ? [] : [[x.shirt_number, `${x.first_name} ${x.last_name}`]])));
  const roleNames = Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]));

  const plan = overview?.weekplan ?? null;
  const planned = plan ? plannedExercises(plan) : [];
  const library = plan ? await loadWeekExercises(supabase, [plan as unknown as Json], team, logoUrl) : null;
  const numbers = planned.flatMap((x) => (x.bankNumber ? [x.bankNumber] : []));
  const { data: bankRows } = numbers.length
    ? await supabase.from("bank_exercises").select("number, title, content").in("number", numbers)
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand uppercase">{p.title}</p>
          <h1 className="text-2xl font-bold tracking-tight">{overview?.titel ?? view.assignment}</h1>
          <p className="mt-1 text-sm text-slate-500">{longDate(view.createdAt.slice(0, 10))}</p>
        </div>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold text-slate-500">{p.assignment}</p>
        <p className="mt-1 text-sm whitespace-pre-line">{view.assignment}</p>
        {view.feedbacks.map((f, i) => (
          <p key={i} className="mt-2 text-sm whitespace-pre-line text-slate-700">
            <span className="font-semibold">{p.feedback}:</span> {f}
          </p>
        ))}
      </section>

      {!overview ? (
        <EmptyState text={p.notReady} href={`/teams/${team.id}/staff-room?opdracht=${view.id}`} link={messages.nav.staffRoom} />
      ) : (
        <OverviewCard overview={overview} roleNames={roleNames} names={names} />
      )}

      {plan && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{p.exercisesTitle}</h2>
            <p className="text-sm text-slate-600">{p.exercisesIntro}</p>
          </div>
          {!planned.length ? (
            <p className="text-sm text-slate-600">{p.noExercises}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {planned.map((x) => {
                const own = x.ownId ? library?.items.get(x.ownId) : undefined;
                const bank = x.bankNumber ? library?.bank.get(x.bankNumber) : undefined;
                const bankRow = (bankRows ?? []).find((b) => b.number === x.bankNumber);
                const goal = (bankRow?.content as { hoofddoel?: unknown } | null)?.hoofddoel;
                const href = x.ownId ? `/exercises/${x.ownId}` : `/exercises/bank/${x.bankNumber}`;
                return (
                  <li key={x.key} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-brand">{x.ownId ? p.own : p.bank(x.bankNumber!)}</p>
                        <h3 className="font-semibold">{own?.title ?? bankRow?.title ?? x.name}</h3>
                        <p className="text-xs text-slate-500">{x.days.join(" · ")}</p>
                      </div>
                      <Link href={href} className="text-sm font-medium text-brand hover:underline">
                        {p.open} →
                      </Link>
                    </div>
                    {own?.animation && library ? (
                      <AnimatedDrawing
                        animation={own.animation}
                        theme={library.display.theme}
                        logoUrl={library.logoUrl}
                        logoOn={library.display.logoOn}
                        labels={messages.exercises.player}
                      />
                    ) : own?.videoUrl ? (
                      <video src={own.videoUrl} controls preload="metadata" className="w-full rounded-lg bg-black" />
                    ) : bank ? (
                      <BankMedia kind={bank.kind} url={bank.url} alt={x.name} className="max-h-80" />
                    ) : null}
                    {typeof goal === "string" && goal && <p className="text-sm text-slate-700">{goal}</p>}
                    {x.coaching.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                        {x.coaching.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
