import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { messages } from "@/lib/messages";
import { opponentLineupSchema } from "@/lib/opponents/validation";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { longDate } from "@/lib/weeks/dates";

import { DeleteOpponentButton } from "./delete-button";
import { FicheForm } from "./fiche-form";
import { OpponentLineupEditor } from "./lineup-editor";

const m = messages.opponents;
const r = messages.matchReport;

export default async function OpponentPage({ params }: { params: Promise<{ teamId: string; opponentId: string }> }) {
  const { teamId, opponentId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  if (!z.uuid().safeParse(opponentId).success) notFound();

  const supabase = await createClient();
  const [{ data: opponent }, { data: lineup }, { data: reports }] = await Promise.all([
    supabase.from("opponents").select("*").eq("id", opponentId).eq("team_id", team.id).maybeSingle(),
    supabase
      .from("opponent_lineups")
      .select("*")
      .eq("opponent_id", opponentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("match_reports").select("*").eq("opponent_id", opponentId).order("match_date", { ascending: false }),
  ]);
  if (!opponent) notFound();
  const parsedLineup = lineup ? opponentLineupSchema.safeParse(lineup) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/teams/${team.id}/opponents`} className="text-sm text-slate-600 hover:text-brand">
          ← {m.back}
        </Link>
        <h2 className="text-lg font-semibold">{opponent.name}</h2>
      </div>

      <FicheForm
        teamId={team.id}
        opponentId={opponent.id}
        canEdit={canEdit}
        initial={{
          name: opponent.name,
          playStyle: opponent.play_style ?? "",
          strengths: opponent.strengths ?? "",
          weaknesses: opponent.weaknesses ?? "",
          setPieces: opponent.set_pieces ?? "",
          notes: opponent.notes ?? "",
          coachName: opponent.coach_name ?? "",
          address: opponent.address ?? "",
        }}
      />

      {lineup && (
        <p className="text-xs text-slate-500">
          {m.lastLineup(longDate(lineup.updated_at.slice(0, 10)), m.source[lineup.source])}
        </p>
      )}
      <OpponentLineupEditor
        teamId={team.id}
        opponentId={opponent.id}
        formations={formationCatalog}
        canEdit={canEdit}
        initial={
          parsedLineup?.success && lineup
            ? { ...parsedLineup.data, matchDate: lineup.match_date }
            : null
        }
      />

      <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">{m.reports}</h2>
        {!reports?.length ? (
          <p className="text-sm text-slate-600">{m.noReports}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reports.map((report) => (
              <li key={report.id} className="space-y-1 py-3 text-sm">
                <p className="font-medium">
                  {longDate(report.match_date)}
                  {report.goals_for !== null && report.goals_against !== null && ` · ${report.goals_for}-${report.goals_against}`}
                  {(report.own_formation || report.opponent_formation) &&
                    ` · ${report.own_formation ?? "?"} – ${report.opponent_formation ?? "?"}`}
                </p>
                {report.went_well && (
                  <p>
                    <span className="text-slate-500">{r.wentWell}:</span> {report.went_well}
                  </p>
                )}
                {report.went_badly && (
                  <p>
                    <span className="text-slate-500">{r.wentBadly}:</span> {report.went_badly}
                  </p>
                )}
                {report.lessons && (
                  <p>
                    <span className="text-slate-500">{r.lessons}:</span> {report.lessons}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <div className="text-right">
          <DeleteOpponentButton teamId={team.id} opponentId={opponent.id} />
        </div>
      )}
    </div>
  );
}
