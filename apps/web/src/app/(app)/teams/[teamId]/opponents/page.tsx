import Link from "next/link";

import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { shortDate } from "@/lib/weeks/dates";

import { NewOpponentForm } from "./new-opponent-form";

const m = messages.opponents;

export default async function OpponentsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: opponents }, { data: lineups }, { data: reports }] = await Promise.all([
    supabase.from("opponents").select("id, name, play_style").eq("team_id", team.id).order("name"),
    supabase.from("opponent_lineups").select("opponent_id, formation, updated_at").eq("team_id", team.id).order("updated_at", { ascending: false }),
    supabase
      .from("match_reports")
      .select("opponent_id, match_date, goals_for, goals_against")
      .eq("team_id", team.id)
      .order("match_date", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">{m.intro}</p>
      {canEdit && <NewOpponentForm teamId={team.id} />}
      {!opponents?.length ? (
        <p className="text-slate-600">{m.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {opponents.map((o) => {
            const lineup = lineups?.find((l) => l.opponent_id === o.id);
            const report = reports?.find((r) => r.opponent_id === o.id);
            return (
              <li key={o.id}>
                <Link href={`/teams/${team.id}/opponents/${o.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                  <span className="w-14 shrink-0 rounded bg-slate-100 px-2 py-1 text-center font-mono text-xs">
                    {lineup?.formation ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.name}</span>
                    {o.play_style && <span className="block truncate text-xs text-slate-500">{o.play_style}</span>}
                  </span>
                  {report && (
                    <span className="text-xs text-slate-500">
                      {m.lastMatch(
                        shortDate(report.match_date),
                        report.goals_for !== null && report.goals_against !== null ? `${report.goals_for}-${report.goals_against}` : null,
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
