import Link from "next/link";
import { notFound } from "next/navigation";

import { Pitch } from "@/components/pitch";
import { SetPieceCard } from "@/components/proposals/match-plan-view";
import { messages } from "@/lib/messages";
import { shirtNames, withShirtNames } from "@/lib/proposals/names";
import { matchTalkToText } from "@/lib/proposals/text";
import type { MatchPlanOutput } from "@/lib/proposals/types";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { isIsoDate, isoWeekday, longDate } from "@/lib/weeks/dates";

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
  const { team } = await getTeamContext(teamId);

  const supabase = await createClient();
  const { data: week } = await supabase
    .from("week_plans")
    .select("id")
    .eq("team_id", team.id)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!week) notFound();

  const [{ data: proposals }, { data: players }] = await Promise.all([
    supabase
      .from("staff_proposals")
      .select("version, status, output")
      .eq("week_plan_id", week.id)
      .eq("role", "tactical-coach")
      .eq("task", "default")
      .not("output", "is", null)
      .order("version", { ascending: false }),
    supabase.from("players").select("shirt_number, first_name, last_name, archived_at").eq("team_id", team.id),
  ]);
  const list = proposals ?? [];
  const proposal =
    list.find((p) => String(p.version) === v) ?? list.find((p) => p.status === "approved") ?? list[0];
  if (!proposal?.output) notFound();

  const output = proposal.output as unknown as MatchPlanOutput;
  const names = shirtNames(players ?? []);
  const n = (text: string) => withShirtNames(text, names);
  const title = `${team.club_name} – ${output.tegenstander.naam}`;
  const back = `/teams/${team.id}/weeks/${weekStart}?tc=${proposal.version}#tc`;

  const header = (
    <div className="space-y-1 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={back} className="text-sm text-slate-600 hover:text-brand">
          ← {t.back}
        </Link>
        <ShareButtons text={matchTalkToText(output, { title, names })} />
      </div>
      {proposal.status !== "approved" && <p className="text-sm text-amber-700">{messages.proposals.share.notApproved}</p>}
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
            <SetPieceCard setPiece={sp} names={names} large />
          </div>
        ))}
      </div>
    );
  }

  const formation = formationCatalog.formaties.find((f) => f.code === output.opstelling.formatie);
  return (
    <div className="space-y-5">
      {header}
      <header>
        <p className="text-sm text-slate-500">
          {team.club_name} – {team.name} · {messages.weeks.weekOf(longDate(weekStart))}
        </p>
        <h1 className="text-3xl font-bold">{n(output.wedstrijdbespreking.titel)}</h1>
        <p className="text-lg">
          {t.opponent}: {output.tegenstander.naam}
          {output.tegenstander.formatie ? ` (${output.tegenstander.formatie})` : ""}
        </p>
      </header>

      <p className="rounded-xl bg-brand/10 px-4 py-3 text-xl font-semibold print:ring-1 print:ring-slate-300">
        {n(output.speelplan.kernboodschap)}
      </p>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,20rem)_1fr] print:grid-cols-[18rem_1fr]">
        <div className="space-y-2">
          <Pitch>
            {output.opstelling.basis.map((b) => {
              const slot = formation?.posten.find((s) => s.id === b.post);
              if (!slot) return null;
              return (
                <div
                  key={b.post}
                  className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {b.rugnummer}
                  </span>
                  <span className="mt-0.5 max-w-full truncate rounded bg-black/60 px-1 text-[10px] text-white">
                    {names.get(b.rugnummer) ?? b.post}
                  </span>
                </div>
              );
            })}
          </Pitch>
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
