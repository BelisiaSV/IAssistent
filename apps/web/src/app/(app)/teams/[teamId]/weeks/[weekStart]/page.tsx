import { FEATURE_FLAGS } from "@iassistent/db";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WeekPlanningView } from "@/components/proposals/week-planning-view";
import { Alert, Button } from "@/components/ui";
import { getStaffProvider } from "@/lib/ai";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { messages } from "@/lib/messages";
import { shirtNames } from "@/lib/proposals/names";
import type { WeekPlanningOutput } from "@/lib/proposals/types";
import { matchDayCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { isIsoDate, isoWeekday, longDate, shortDate, weekdayName, weekDates } from "@/lib/weeks/dates";
import { weekPlanSchema } from "@/lib/weeks/validation";

import { decideProposal } from "../actions";
import { AdjustProposalForm, RefreshWhileGenerating, RequestProposalButton } from "./proposal-controls";
import { WeekInputForm } from "./week-input-form";

// Generating a proposal with the AI can take a few minutes (runs after the response).
export const maxDuration = 300;

const m = messages.proposals;

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { v } = await searchParams;
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team, canEdit } = await getTeamContext(teamId);

  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("*")
    .eq("team_id", team.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) notFound();

  const [{ data: proposalRows }, { data: players }, flagEnabled] = await Promise.all([
    supabase
      .from("staff_proposals")
      .select("*")
      .eq("week_plan_id", week.id)
      .eq("role", "assistant-coach")
      .order("version", { ascending: false }),
    supabase.from("players").select("shirt_number, first_name, last_name, archived_at").eq("team_id", team.id),
    isFeatureEnabled(FEATURE_FLAGS.assistantCoach),
  ]);
  const proposals = proposalRows ?? [];
  const selected = proposals.find((p) => String(p.version) === v) ?? proposals[0] ?? null;
  const names = shirtNames(players ?? []);

  const parsed = weekPlanSchema(weekStart).safeParse({
    trainings: week.trainings,
    matches: week.matches,
    previousMatchDate: week.previous_match_date,
    notes: week.notes ?? "",
  });
  const initial = parsed.success
    ? parsed.data
    : { trainings: [], matches: [], previousMatchDate: week.previous_match_date, notes: week.notes };

  const canRequest = canEdit && flagEnabled;
  const testMode = getStaffProvider().id === "example";
  const busy = proposals.some((p) => p.status === "generating");
  const basePath = `/teams/${team.id}/weeks/${weekStart}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/teams/${team.id}/weeks`} className="text-sm text-slate-600 hover:text-brand">
          ← {messages.weeks.title}
        </Link>
        <h2 className="text-lg font-semibold">{messages.weeks.weekOf(longDate(weekStart))}</h2>
      </div>

      <WeekInputForm
        teamId={team.id}
        weekStart={weekStart}
        days={weekDates(weekStart).map((date) => ({ date, weekday: weekdayName(date), label: shortDate(date) }))}
        initial={initial}
        matchDays={matchDayCatalog}
        canEdit={canEdit}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{m.role}</h2>
          {canRequest && !busy && <RequestProposalButton teamId={team.id} weekStart={weekStart} />}
        </div>
        {canEdit && !flagEnabled && <Alert tone="error">{m.flagOff}</Alert>}
        {canRequest && testMode && <p className="text-xs text-slate-500">{m.testMode}</p>}

        {proposals.length > 0 && (
          <nav className="flex flex-wrap gap-2">
            {proposals.map((p) => (
              <Link
                key={p.id}
                href={`${basePath}?v=${p.version}`}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${
                  p.id === selected?.id ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200"
                }`}
              >
                {m.version(p.version)} · {m.status[p.status]}
              </Link>
            ))}
          </nav>
        )}

        {!selected && <p className="text-sm text-slate-600">{m.noProposals}</p>}
        {selected?.feedback && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">
            <span className="font-medium">{m.feedbackGiven}:</span> {selected.feedback}
          </p>
        )}
        {selected?.status === "generating" && <RefreshWhileGenerating />}
        {selected?.status === "failed" && <Alert tone="error">{m.errors.generationFailed}</Alert>}

        {selected?.output && selected.status !== "generating" && (
          <>
            {selected.provider === "example" && <p className="text-xs text-slate-500">{m.testMode}</p>}
            <div className="flex flex-wrap items-start gap-2">
              {canEdit && selected.status !== "approved" && (
                <DecisionButton teamId={team.id} weekStart={weekStart} proposalId={selected.id} decision="approved" />
              )}
              {canEdit && selected.status !== "rejected" && (
                <DecisionButton teamId={team.id} weekStart={weekStart} proposalId={selected.id} decision="rejected" />
              )}
              <Link
                href={`${basePath}/print?v=${selected.version}`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {m.print}
              </Link>
              {canRequest && !busy && <AdjustProposalForm teamId={team.id} weekStart={weekStart} />}
            </div>
            <WeekPlanningView output={selected.output as unknown as WeekPlanningOutput} names={names} />
          </>
        )}
      </section>
    </div>
  );
}

function DecisionButton({
  teamId,
  weekStart,
  proposalId,
  decision,
}: {
  teamId: string;
  weekStart: string;
  proposalId: string;
  decision: "approved" | "rejected";
}) {
  return (
    <form action={decideProposal}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant={decision === "approved" ? "primary" : "secondary"}>
        {decision === "approved" ? m.approve : m.reject}
      </Button>
    </form>
  );
}
