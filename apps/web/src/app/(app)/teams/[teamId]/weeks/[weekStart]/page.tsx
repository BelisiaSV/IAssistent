import type { Tables } from "@iassistent/db";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadChart } from "@/components/proposals/load-chart";
import { MatchPrepView } from "@/components/proposals/tactical-views";
import { type WeekDocument, WeekDocumentView } from "@/components/proposals/week-document-view";
import { Alert, Button } from "@/components/ui";
import { getStaffProvider } from "@/lib/ai";
import { loadWeekExercises } from "@/lib/exercises/week";
import { messages } from "@/lib/messages";
import { opponentNames } from "@/lib/opponents/context";
import { shirtNames } from "@/lib/proposals/names";
import type { LoadPlanOutput, MatchPrepOutput } from "@/lib/proposals/types";
import { RUN_STEPS, type RunKind } from "@/lib/roles";
import { matchPrepFrom } from "@/lib/staff-runs/gate";
import { enabledSteps } from "@/lib/staff-runs/server";
import { formationCatalog, matchDayCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { sessionAu } from "@/lib/weeks/context";
import { isIsoDate, isoWeekday, longDate, shortDate, todayInBelgium, weekdayName, weekDates } from "@/lib/weeks/dates";
import { loadWeek, squadMas } from "@/lib/weeks/load";
import { weekPlanSchema } from "@/lib/weeks/validation";

import { decideRunAction, lineupFromProposal } from "../actions";
import { MatchReportForm } from "./match-report-form";
import { AdjustRunForm, DeleteRunButton, RequestRunButton, RetryRunButton, RunProgress, StepList } from "./run-controls";
import { SessionLoadForm } from "./session-load-form";
import { WeekInputForm } from "./week-input-form";

// Generating a proposal with the AI can take a few minutes (runs after the response).
export const maxDuration = 300;

const m = messages.proposals;
const p = messages.weeks.periodization;

type Proposal = Tables<"staff_proposals">;
type Run = Tables<"staff_runs">;
const r = messages.staffRun;

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { teamId, weekStart } = await params;
  const query = await searchParams;
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team, canEdit, logoUrl } = await getTeamContext(teamId);

  const supabase = await createClient();
  const data = await loadWeek(supabase, team, weekStart);
  if (!data.week) notFound();
  const week = data.week;

  const [weekSteps, matchSteps] = await Promise.all([enabledSteps("week"), enabledSteps("match")]);

  const parsed = weekPlanSchema(weekStart).safeParse({
    trainings: week.trainings,
    matches: week.matches,
    previousMatchDate: week.previous_match_date,
    notes: week.notes ?? "",
  });
  const input = parsed.success
    ? parsed.data
    : { trainings: [], matches: [], previousMatchDate: week.previous_match_date, notes: week.notes };

  const names = shirtNames(data.players);
  const testMode = getStaffProvider().id === "example";
  const basePath = `/teams/${team.id}/weeks/${weekStart}`;

  const selectedRun = (kind: RunKind) => {
    const list = data.runs.filter((x) => x.kind === kind);
    return { list, selected: list.find((x) => String(x.version) === query[kind]) ?? list[0] ?? null };
  };
  const weekRun = selectedRun("week");
  const matchRun = selectedRun("match");
  const outputsOf = (run: Run | null) =>
    Object.fromEntries(
      data.proposals.filter((x) => run && x.run_id === run.id && x.output).map((x) => [x.step ?? "", x.output]),
    ) as Record<string, unknown>;
  const weekOutputs = outputsOf(weekRun.selected);
  const approvedWeekRun = data.runs.find((x) => x.kind === "week" && x.status === "approved") ?? null;
  const approvedWeek = outputsOf(approvedWeekRun);
  const theirNames = opponentNames(data.opponentLineup);
  const exercises = await loadWeekExercises(
    supabase,
    data.proposals.filter((x) => ["ac", "tc", "match"].includes(x.step ?? "")).map((x) => x.output),
    team,
    logoUrl,
  );

  // Sessions of this week that already took place, for logging the actual RPE.
  const today = todayInBelgium();
  const sessions = weekDates(weekStart)
    .filter((date) => date <= today)
    .flatMap((date) => {
      const training = input.trainings.find((t) => t.date === date);
      const match = input.matches.find((x) => x.date === date);
      const kind = match ? ("match" as const) : training ? ("training" as const) : null;
      if (!kind) return [];
      const logged = data.sessionsThisWeek.find((s) => s.session_date === date && s.kind === kind);
      return [
        {
          date,
          kind,
          label: `${weekdayName(date)} ${shortDate(date)} · ${kind === "match" ? messages.weeks.input.match : messages.weeks.input.training}`,
          rpe: logged ? Number(logged.rpe) : null,
          duration: logged?.duration_min ?? training?.duration_min ?? 90,
          attendance: logged?.attendance ?? null,
        },
      ];
    });

  const loadPlanForChart = (approvedWeek.pc ?? weekOutputs.pc ?? null) as LoadPlanOutput | null;
  const matchFrom = matchPrepFrom(input.trainings, input.matches, weekStart);

  // Matches of this week that were played: the head coach adds his findings.
  const playedMatches = input.matches.filter((x) => x.date <= today);
  const formationOptions = formationCatalog.formaties.map((f) => ({ code: f.code, name: f.naam }));
  const chartDays = weekDates(weekStart).map((date) => {
    const logged = data.sessionsThisWeek.find((s) => s.session_date === date && s.kind === "training");
    return {
      date,
      label: weekdayName(date).slice(0, 2),
      planned: loadPlanForChart?.dagen.find((d) => d.datum === date)?.au_doel ?? null,
      actual: logged ? sessionAu(Number(logged.rpe), logged.duration_min) : null,
    };
  });

  const masPlayers = squadMas(data, names);

  const type = data.periodization.weektype;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teams/${team.id}/weeks`} className="text-sm text-slate-600 hover:text-brand">
          ← {messages.weeks.title}
        </Link>
        <h2 className="text-lg font-semibold">{messages.weeks.weekOf(longDate(weekStart))}</h2>
      </div>

      <p className="rounded-md bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
        {!type
          ? p.notSet
          : [
              data.periodization.fase
                ? `${p.phase[data.periodization.fase]}${data.periodization.week_van_fase ? ` ${p.phaseWeek(data.periodization.week_van_fase)}` : ""}`
                : null,
              type.naam,
              data.periodization.week_in_cyclus && data.periodization.cyclus_weken
                ? p.week(data.periodization.week_in_cyclus, data.periodization.cyclus_weken)
                : null,
              type.belasting_pct ? p.load(type.belasting_pct.min, type.belasting_pct.max) : null,
              type.km_zonder_wedstrijd ? p.km(type.km_zonder_wedstrijd.min, type.km_zonder_wedstrijd.max) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
      </p>

      <WeekInputForm
        teamId={team.id}
        weekStart={weekStart}
        days={weekDates(weekStart).map((date) => ({ date, weekday: weekdayName(date), label: shortDate(date) }))}
        initial={input}
        matchDays={matchDayCatalog}
        opponents={data.opponents.map((o) => o.name).sort((a, b) => a.localeCompare(b, "nl"))}
        canEdit={canEdit}
      />

      <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">{messages.weeks.load.title}</h2>
        <p className="text-sm text-slate-600">{messages.weeks.load.hint}</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-500">{messages.weeks.load.none}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <SessionLoadForm key={`${s.date}-${s.kind}`} teamId={team.id} weekStart={weekStart} session={s} canEdit={canEdit} />
            ))}
          </div>
        )}
      </section>

      <LoadChart days={chartDays} />

      {playedMatches.length > 0 && (
        <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold">{messages.matchReport.title}</h2>
          <p className="text-sm text-slate-600">{messages.matchReport.hint}</p>
          {playedMatches.map((match) => {
            const report = data.reports.find((r) => r.match_date === match.date);
            return (
              <MatchReportForm
                key={match.date}
                teamId={team.id}
                weekStart={weekStart}
                match={{
                  date: match.date,
                  label: `${weekdayName(match.date)} ${shortDate(match.date)} · ${match.opponent} (${match.home ? messages.weeks.input.home : messages.weeks.input.away})`,
                }}
                initial={
                  report
                    ? {
                        goalsFor: report.goals_for,
                        goalsAgainst: report.goals_against,
                        ownFormation: report.own_formation,
                        opponentFormation: report.opponent_formation,
                        wentWell: report.went_well,
                        wentBadly: report.went_badly,
                        lessons: report.lessons,
                      }
                    : null
                }
                formations={formationOptions}
                canEdit={canEdit}
              />
            );
          })}
        </section>
      )}

      <RunSection
        kind="week"
        title={r.week.title}
        intro={r.week.intro}
        requestLabel={r.week.request}
        generatingLabel={r.week.generating}
        {...weekRun}
        proposals={data.proposals}
        stepKeys={weekSteps.map((x) => x.key)}
        teamId={team.id}
        weekStart={weekStart}
        basePath={basePath}
        canEdit={canEdit}
        testMode={testMode}
        blockedReason={null}
        links={(run) => [{ href: `${basePath}/print?week=${run.version}`, label: r.week.print }]}
        render={(run) => {
          const out = outputsOf(run);
          return (
            <WeekDocumentView
              doc={{ pc: out.pc ?? null, tc: out.tc ?? null, ac: out.ac ?? null, tco: out.tco ?? null } as WeekDocument}
              names={names}
              opponentNames={theirNames}
              masPlayers={masPlayers}
              exercises={exercises}
              runId={canEdit ? run.id : undefined}
            />
          );
        }}
      />

      {matchFrom && (
        <RunSection
          kind="match"
          title={r.match.title}
          intro={r.match.intro}
          requestLabel={r.match.request}
          generatingLabel={r.match.generating}
          {...matchRun}
          proposals={data.proposals}
          stepKeys={matchSteps.map((x) => x.key)}
          teamId={team.id}
          weekStart={weekStart}
          basePath={basePath}
          canEdit={canEdit}
          testMode={testMode}
          blockedReason={!approvedWeekRun ? r.match.needsWeek : today < matchFrom ? r.match.from(longDate(matchFrom)) : null}
          links={(run) => [
            { href: `${basePath}/print/match?v=${run.version}&part=talk`, label: messages.matchPlan.printTalk },
            { href: `${basePath}/print/match?v=${run.version}&part=set-pieces`, label: messages.matchPlan.printSetPieces },
          ]}
          render={(run) => {
            const proposal = data.proposals.find((x) => x.run_id === run.id && x.step === "match");
            if (!proposal?.output) return null;
            return (
              <MatchPrepView
                output={proposal.output as unknown as MatchPrepOutput}
                names={names}
                formations={formationCatalog}
                library={exercises}
                source={canEdit ? { runId: run.id, step: "match" } : undefined}
                actions={
                  canEdit && (
                    <form action={lineupFromProposal}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="weekStart" value={weekStart} />
                      <input type="hidden" name="proposalId" value={proposal.id} />
                      <Button type="submit" variant="secondary">
                        {messages.matchPlan.toLineup}
                      </Button>
                    </form>
                  )
                }
              />
            );
          }}
        />
      )}
    </div>
  );
}

/** A request to the staff (week document or match preparation) with its versions. */
function RunSection({
  kind,
  title,
  intro,
  requestLabel,
  generatingLabel,
  list,
  selected,
  proposals,
  stepKeys,
  teamId,
  weekStart,
  basePath,
  canEdit,
  testMode,
  blockedReason,
  links,
  render,
}: {
  kind: RunKind;
  title: string;
  intro: string;
  requestLabel: string;
  generatingLabel: string;
  list: Run[];
  selected: Run | null;
  proposals: Proposal[];
  stepKeys: string[];
  teamId: string;
  weekStart: string;
  basePath: string;
  canEdit: boolean;
  testMode: boolean;
  blockedReason: string | null;
  links: (run: Run) => { href: string; label: string }[];
  render: (run: Run) => ReactNode;
}) {
  const busy = list.some((x) => x.status === "generating");
  const canRequest = canEdit && stepKeys.length > 0 && !blockedReason && !busy;
  const stepsOf = (run: Run) =>
    RUN_STEPS[kind]
      .map((step) => ({ step, proposal: proposals.find((x) => x.run_id === run.id && x.step === step.key) }))
      .filter((x) => x.proposal)
      .map(({ step, proposal }) => ({ key: step.key, name: r.stepNames[step.key] ?? step.key, status: proposal!.status }));
  const adjustable = RUN_STEPS[kind].filter((x) => stepKeys.includes(x.key)).map((x) => ({ key: x.key, name: r.stepNames[x.key] ?? x.key }));

  return (
    <section id={kind} className="scroll-mt-4 space-y-4 border-t border-slate-200 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-slate-600">{intro}</p>
        </div>
        {canRequest && <RequestRunButton teamId={teamId} weekStart={weekStart} kind={kind} label={requestLabel} />}
      </div>
      {blockedReason && <p className="text-sm text-slate-600">{blockedReason}</p>}
      {canEdit && stepKeys.length === 0 && <Alert tone="error">{r.flagOff}</Alert>}

      {list.length > 0 && (
        <nav className="flex flex-wrap gap-2">
          {list.map((x) => (
            <Link
              key={x.id}
              href={`${basePath}?${kind}=${x.version}#${kind}`}
              scroll={false}
              className={`rounded-full px-3 py-1 text-xs ring-1 ${
                x.id === selected?.id ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200"
              }`}
            >
              {m.version(x.version)} · {m.status[x.status]}
            </Link>
          ))}
        </nav>
      )}

      {!selected && <p className="text-sm text-slate-600">{r.none}</p>}
      {selected?.feedback && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          <span className="font-medium">
            {m.feedbackGiven}
            {selected.feedback_step ? ` (${r.stepNames[selected.feedback_step] ?? selected.feedback_step})` : ""}:
          </span>{" "}
          {selected.feedback}
        </p>
      )}
      {selected?.status === "generating" && (
        <RunProgress teamId={teamId} weekStart={weekStart} runId={selected.id} label={generatingLabel} steps={stepsOf(selected)} />
      )}
      {selected?.status === "failed" && (
        <div className="space-y-3">
          <Alert tone="error">{r.failed}</Alert>
          <StepList steps={stepsOf(selected)} />
          {canEdit && !busy && (
            <div className="flex flex-wrap gap-2">
              <RetryRunButton teamId={teamId} weekStart={weekStart} kind={kind} runId={selected.id} />
              <DeleteRunButton teamId={teamId} weekStart={weekStart} runId={selected.id} />
            </div>
          )}
        </div>
      )}

      {selected && ["ready", "approved", "rejected"].includes(selected.status) && (
        <>
          {(selected.provider === "example" || testMode) && <p className="text-xs text-slate-500">{m.testMode}</p>}
          <div className="flex flex-wrap items-start gap-2 print:hidden">
            {canEdit && selected.status !== "approved" && (
              <DecisionButton teamId={teamId} weekStart={weekStart} runId={selected.id} decision="approved" />
            )}
            {canEdit && selected.status !== "rejected" && (
              <DecisionButton teamId={teamId} weekStart={weekStart} runId={selected.id} decision="rejected" />
            )}
            {links(selected).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
            {canEdit && selected.status !== "approved" && (
              <DeleteRunButton teamId={teamId} weekStart={weekStart} runId={selected.id} />
            )}
            {canEdit && !busy && (
              <AdjustRunForm teamId={teamId} weekStart={weekStart} kind={kind} runId={selected.id} steps={adjustable} />
            )}
          </div>
          {render(selected)}
        </>
      )}
    </section>
  );
}

function DecisionButton({
  teamId,
  weekStart,
  runId,
  decision,
}: {
  teamId: string;
  weekStart: string;
  runId: string;
  decision: "approved" | "rejected";
}) {
  return (
    <form action={decideRunAction}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant={decision === "approved" ? "primary" : "secondary"}>
        {decision === "approved" ? r.approveAll : m.reject}
      </Button>
    </form>
  );
}
