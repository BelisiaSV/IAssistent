import Link from "next/link";

import { Card, EmptyState } from "@/components/card";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { OUTCOME_COLORS } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";
import { longDate, mondayOf } from "@/lib/weeks/dates";

const m = messages.evaluationsPage;
const r = messages.matchReport;
const letters = messages.dashboard.form.letter;

/** Evaluaties: the match reports of the team, newest first. */
export default async function EvaluationsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: reports }, { data: cards }, { data: players }] = await Promise.all([
    supabase.from("match_reports").select("*").eq("team_id", team.id).order("match_date", { ascending: false }).limit(60),
    supabase.from("player_cards").select("id, player_id, match_date, card").eq("team_id", team.id),
    supabase.from("players").select("id, shirt_number, first_name, last_name").eq("team_id", team.id),
  ]);
  const playerName = (id: string) => {
    const p = (players ?? []).find((x) => x.id === id);
    return p ? `${p.shirt_number ?? "–"} · ${p.first_name} ${p.last_name}` : "?";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      {!reports?.length ? (
        <EmptyState text={m.none} href={`/teams/${team.id}/weeks`} link={messages.nav.microcycle} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reports.map((report) => {
            const scored = report.goals_for !== null && report.goals_against !== null;
            const outcome = !scored ? null : report.goals_for! > report.goals_against! ? "win" : report.goals_for === report.goals_against ? "draw" : "loss";
            const notes = [
              [r.wentWell, report.went_well],
              [r.wentBadly, report.went_badly],
              [r.lessons, report.lessons],
            ].filter((n): n is [string, string] => !!n[1]);
            return (
              <li key={report.id}>
                <Card className="h-full p-5">
                  <div className="flex items-start gap-3">
                    {outcome && (
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: OUTCOME_COLORS[outcome] }}
                      >
                        {letters[outcome]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500">
                        {longDate(report.match_date)}
                        {report.home !== null && ` · ${report.home ? m.home : m.away}`}
                      </p>
                      <p className="truncate font-semibold">
                        {report.opponent_id ? (
                          <Link href={`/teams/${team.id}/opponents/${report.opponent_id}`} className="hover:underline">
                            {report.opponent_name}
                          </Link>
                        ) : (
                          report.opponent_name
                        )}
                      </p>
                      {(report.own_formation || report.opponent_formation) && (
                        <p className="text-xs text-slate-500">
                          {[report.own_formation, report.opponent_formation].map((f) => f ?? "?").join(" – ")}
                        </p>
                      )}
                    </div>
                    {scored && (
                      <span className="text-xl font-extrabold tabular-nums">
                        {report.goals_for}-{report.goals_against}
                      </span>
                    )}
                  </div>
                  {notes.length > 0 && (
                    <dl className="mt-4 space-y-2 text-sm">
                      {notes.map(([label, text]) => (
                        <div key={label}>
                          <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                          <dd className="whitespace-pre-line text-slate-700">{text}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {(cards ?? []).some((c) => c.match_date === report.match_date) && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500">{messages.cards.title}</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {(cards ?? [])
                          .filter((c) => c.match_date === report.match_date)
                          .map((c) => (
                            <li key={c.id} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-xs ring-1 ring-slate-200">
                              <span aria-hidden className="inline-block h-3 w-2 rounded-[2px]" style={{ backgroundColor: c.card === "yellow" ? "#facc15" : "#dc2626" }} />
                              {playerName(c.player_id)}
                              <span className="sr-only">{messages.cards[c.card]}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  <Link href={`/teams/${team.id}/weeks/${mondayOf(report.match_date)}`} className="mt-4 inline-block text-xs font-medium text-brand hover:underline">
                    {m.toWeek} →
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
