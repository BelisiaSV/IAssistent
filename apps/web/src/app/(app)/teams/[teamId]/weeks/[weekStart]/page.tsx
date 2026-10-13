import type { Tables } from "@iassistent/db";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LoadChart } from "@/components/proposals/load-chart";
import { LoadPlanView, type MasPlayer } from "@/components/proposals/load-plan-view";
import { WeekPlanningView } from "@/components/proposals/week-planning-view";
import { Alert, Button } from "@/components/ui";
import { getStaffProvider } from "@/lib/ai";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { messages } from "@/lib/messages";
import { shirtNames } from "@/lib/proposals/names";
import type { LoadPlanOutput, WeekPlanningOutput } from "@/lib/proposals/types";
import { WEEK_ROLES, type WeekRoleId } from "@/lib/roles";
import { matchDayCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { sessionAu } from "@/lib/weeks/context";
import { isIsoDate, isoWeekday, longDate, shortDate, todayInBelgium, weekdayName, weekDates } from "@/lib/weeks/dates";
import { loadWeek, type WeekData } from "@/lib/weeks/load";
import { weekPlanSchema } from "@/lib/weeks/validation";

import { decideProposal } from "../actions";
import { AdjustProposalForm, RefreshWhileGenerating, RequestProposalButton } from "./proposal-controls";
import { SessionLoadForm } from "./session-load-form";
import { WeekInputForm } from "./week-input-form";

// Generating a proposal with the AI can take a few minutes (runs after the response).
export const maxDuration = 300;

const m = messages.proposals;
const p = messages.weeks.periodization;

type Proposal = Tables<"staff_proposals">;

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
  const { team, canEdit } = await getTeamContext(teamId);

  const supabase = await createClient();
  const data = await loadWeek(supabase, team, weekStart);
  if (!data.week) notFound();
  const week = data.week;

  const flags = Object.fromEntries(
    await Promise.all(WEEK_ROLES.map(async (r) => [r.id, await isFeatureEnabled(r.flag)] as const)),
  ) as Record<WeekRoleId, boolean>;

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
  const busy = data.proposals.some((x) => x.status === "generating");
  const basePath = `/teams/${team.id}/weeks/${weekStart}`;

  const selectedFor = (roleId: WeekRoleId, param: string) => {
    const list = data.proposals.filter((x) => x.role === roleId);
    return { list, selected: list.find((x) => String(x.version) === query[param]) ?? list[0] ?? null };
  };
  const pc = selectedFor("physical-coach", "pc");
  const ac = selectedFor("assistant-coach", "ac");
  const approvedLoadPlan = data.proposals.find((x) => x.role === "physical-coach" && x.status === "approved");

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

  const loadPlanForChart = (approvedLoadPlan?.output ?? pc.selected?.output ?? null) as LoadPlanOutput | null;
  const chartDays = weekDates(weekStart).map((date) => {
    const logged = data.sessionsThisWeek.find((s) => s.session_date === date && s.kind === "training");
    return {
      date,
      label: weekdayName(date).slice(0, 2),
      planned: loadPlanForChart?.dagen.find((d) => d.datum === date)?.au_doel ?? null,
      actual: logged ? sessionAu(Number(logged.rpe), logged.duration_min) : null,
    };
  });

  const masPlayers: MasPlayer[] = latestMas(data)
    .flatMap(({ playerId, mas }) => {
      const player = data.players.find((x) => x.id === playerId && !x.archived_at);
      return player?.shirt_number ? [{ shirtNumber: player.shirt_number, name: names.get(player.shirt_number) ?? "", mas }] : [];
    })
    .sort((a, b) => a.shirtNumber - b.shirtNumber);

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

      <RoleSection
        roleId="physical-coach"
        param="pc"
        {...pc}
        teamId={team.id}
        weekStart={weekStart}
        basePath={basePath}
        canEdit={canEdit}
        flagEnabled={flags["physical-coach"]}
        testMode={testMode}
        busy={busy}
        render={(output) => <LoadPlanView output={output as LoadPlanOutput} names={names} masPlayers={masPlayers} />}
      />

      <RoleSection
        roleId="assistant-coach"
        param="ac"
        {...ac}
        teamId={team.id}
        weekStart={weekStart}
        basePath={basePath}
        canEdit={canEdit}
        flagEnabled={flags["assistant-coach"]}
        testMode={testMode}
        busy={busy}
        note={approvedLoadPlan ? messages.roles["assistant-coach"].usesLoadPlan : messages.roles["assistant-coach"].noLoadPlan}
        printable
        render={(output) => <WeekPlanningView output={output as WeekPlanningOutput} names={names} />}
      />
    </div>
  );
}

function latestMas(data: WeekData) {
  const latest = new Map<string, { date: string; mas: number }>();
  for (const t of data.testResults) {
    if (t.test_code !== "vameval") continue;
    const current = latest.get(t.player_id);
    if (!current || current.date < t.test_date) latest.set(t.player_id, { date: t.test_date, mas: t.result });
  }
  return [...latest.entries()].map(([playerId, v]) => ({ playerId, mas: v.mas }));
}

function RoleSection({
  roleId,
  param,
  list,
  selected,
  teamId,
  weekStart,
  basePath,
  canEdit,
  flagEnabled,
  testMode,
  busy,
  note,
  printable = false,
  render,
}: {
  roleId: WeekRoleId;
  param: string;
  list: Proposal[];
  selected: Proposal | null;
  teamId: string;
  weekStart: string;
  basePath: string;
  canEdit: boolean;
  flagEnabled: boolean;
  testMode: boolean;
  busy: boolean;
  note?: string;
  printable?: boolean;
  render: (output: unknown) => React.ReactNode;
}) {
  const r = messages.roles[roleId];
  const canRequest = canEdit && flagEnabled;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{r.name}</h2>
        {canRequest && !busy && <RequestProposalButton teamId={teamId} weekStart={weekStart} roleId={roleId} />}
      </div>
      {note && flagEnabled && <p className="text-xs text-slate-600">{note}</p>}
      {canEdit && !flagEnabled && <Alert tone="error">{r.flagOff}</Alert>}

      {list.length > 0 && (
        <nav className="flex flex-wrap gap-2">
          {list.map((x) => (
            <Link
              key={x.id}
              href={`${basePath}?${param}=${x.version}`}
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

      {!selected && <p className="text-sm text-slate-600">{m.noProposals}</p>}
      {selected?.feedback && (
        <p className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          <span className="font-medium">{m.feedbackGiven}:</span> {selected.feedback}
        </p>
      )}
      {selected?.status === "generating" && <RefreshWhileGenerating label={r.generating} />}
      {selected?.status === "failed" && <Alert tone="error">{m.errors.generationFailed}</Alert>}

      {selected?.output && selected.status !== "generating" && (
        <>
          {(selected.provider === "example" || (testMode && !selected.provider)) && (
            <p className="text-xs text-slate-500">{m.testMode}</p>
          )}
          <div className="flex flex-wrap items-start gap-2">
            {canEdit && selected.status !== "approved" && (
              <DecisionButton teamId={teamId} weekStart={weekStart} proposalId={selected.id} decision="approved" />
            )}
            {canEdit && selected.status !== "rejected" && (
              <DecisionButton teamId={teamId} weekStart={weekStart} proposalId={selected.id} decision="rejected" />
            )}
            {printable && (
              <Link
                href={`${basePath}/print?v=${selected.version}`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {m.print}
              </Link>
            )}
            {canRequest && !busy && <AdjustProposalForm teamId={teamId} weekStart={weekStart} roleId={roleId} />}
          </div>
          {render(selected.output)}
        </>
      )}
    </section>
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
