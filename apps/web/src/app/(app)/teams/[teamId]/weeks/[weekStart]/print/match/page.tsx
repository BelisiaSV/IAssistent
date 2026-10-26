import Link from "next/link";
import { notFound } from "next/navigation";

import { LineupPitch, SetPieceCard } from "@/components/proposals/tactical-views";
import { loadWeekExercises } from "@/lib/exercises/week";
import { messages } from "@/lib/messages";
import { shirtNames, withShirtNames } from "@/lib/proposals/names";
import { matchTalkToText } from "@/lib/proposals/text";
import type { MatchPrepOutput, TacticalWeekOutput } from "@/lib/proposals/types";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { isIsoDate, isoWeekday, longDate } from "@/lib/weeks/dates";
import type { WeekMatch } from "@/lib/weeks/validation";

import { ShareButtons } from "../copy-button";

const t = messages.matchPlan;

/**
 * Printable parts of the Tactical Coach match plan: the match talk, or the set
 * pieces with one per A4 page to hang in the dressing room.
 */
export default async function PrintMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string; weekStart: string }>;
  searchParams: Promise<{ v?: string; part?: string }>;
}) {
  const { teamId, weekStart } = await params;
  const { v, part } = await searchParams;
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team, logoUrl } = await getTeamContext(teamId);

  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("id, matches")
    .eq("team_id", team.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) notFound();

  const [{ data: runs }, { data: proposals }, { data: players }] = await Promise.all([
    supabase.from("staff_runs").select("*").eq("week_plan_id", week.id).order("version", { ascending: false }),
    supabase
      .from("staff_proposals")
      .select("run_id, step, output")
      .eq("week_plan_id", week.id)
      .in("step", ["match", "tc"])
      .not("output", "is", null),
    supabase.from("players").select("shirt_number, first_name, last_name, archived_at").eq("team_id", team.id),
  ]);
  const matchRuns = (runs ?? []).filter((x) => x.kind === "match" && x.status !== "generating" && x.status !== "failed");
  const run =
    matchRuns.find((x) => String(x.version) === v) ?? matchRuns.find((x) => x.status === "approved") ?? matchRuns[0];
  const proposal = (proposals ?? []).find((x) => x.run_id === run?.id && x.step === "match");
  if (!run || !proposal?.output) notFound();

  const approvedWeek = (runs ?? []).find((x) => x.kind === "week" && x.status === "approved");
  const weekPlan = (proposals ?? []).find((x) => x.run_id === approvedWeek?.id && x.step === "tc")?.output as unknown as
    | TacticalWeekOutput
    | undefined;
  const opponent = ((week.matches ?? []) as WeekMatch[]).toSorted((a, b) => a.date.localeCompare(b.date))[0]?.opponent;

  const output = proposal.output as unknown as MatchPrepOutput;
  const library = await loadWeekExercises(supabase, [proposal.output], team, logoUrl);
  const names = shirtNames(players ?? []);
  const n = (text: string) => withShirtNames(text, names);
  const title = [team.club_name, opponent].filter(Boolean).join(" – ");
  const keyMessage = weekPlan?.speelplan.kernboodschap ?? null;
  const back = `/teams/${team.id}/weeks/${weekStart}?match=${run.version}#match`;

  const header = (
    <div className="space-y-1 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="text-sm text-slate-600 hover:text-brand">
          ← {t.back}
        </Link>
        <ShareButtons text={matchTalkToText(output, { title, names, keyMessage })} />
      </div>
      {run.status !== "approved" && <p className="text-sm text-amber-700">{messages.proposals.share.notApproved}</p>}
      <p className="text-xs text-slate-500">{t.printHint}</p>
    </div>
  );

  if (part === "set-pieces") {
    return (
      <div className="space-y-6">
        {header}
        {output.standaardsituaties.map((sp, i) => (
          <div key={i} className="break-after-page print:min-h-[270mm]">
            <p className="mb-2 text-sm text-slate-500">{title}</p>
            <SetPieceCard setPiece={sp} names={names} large library={library} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <header>
        <p className="text-sm text-slate-500">
          {team.club_name} – {team.name} · {messages.weeks.weekOf(longDate(weekStart))}
        </p>
        <h1 className="text-3xl font-bold">{n(output.wedstrijdbespreking.titel)}</h1>
        <p className="text-lg">
          {t.opponent}: {opponent ?? weekPlan?.tegenstander.naam}
          {weekPlan?.tegenstander.formatie ? ` (${weekPlan.tegenstander.formatie})` : ""}
        </p>
      </header>

      {keyMessage && (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-xl font-semibold print:ring-1 print:ring-slate-300">
          {n(keyMessage)}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-[minmax(0,20rem)_1fr] print:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          <LineupPitch lineup={output.opstelling} names={names} formations={formationCatalog} />
          {output.opstelling.bank.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">{t.bench}:</span> {output.opstelling.bank.map((nr) => n(`#${nr}`)).join(", ")}
            </p>
          )}
        </div>
        <ol className="list-decimal space-y-3 pl-6 text-xl">
          {output.wedstrijdbespreking.kernpunten.map((k, i) => (
            <li key={i}>{n(k)}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-2xl font-bold">{n(output.wedstrijdbespreking.afsluiter)}</p>
    </div>
  );
}
