import { Card, CardHeader, EmptyState, StatTile } from "@/components/card";
import { SeasonChart } from "@/components/reports/season-chart";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { OUTCOME_COLORS, seasonResults } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";
import { longDate } from "@/lib/weeks/dates";

const m = messages.reportsPage.season;
const letters = messages.dashboard.form.letter;

/** Seizoensverloop: points over the season and every result. */
export default async function SeasonReportPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("match_reports")
    .select("match_date, opponent_name, home, goals_for, goals_against")
    .eq("team_id", team.id);
  const season = seasonResults(reports ?? [], team.competition_start_date);
  const diff = season.goalsFor - season.goalsAgainst;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {m.hint}
          {team.competition_start_date && ` ${m.since(longDate(team.competition_start_date))}.`}
        </p>
      </div>
      {!season.matches.length ? (
        <EmptyState text={m.none} href={`/teams/${team.id}/evaluations`} link={messages.nav.evaluations} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={m.points} value={season.points} />
            <StatTile label={m.played} value={season.matches.length} />
            <StatTile label={m.result} value={`${season.counts.win}-${season.counts.draw}-${season.counts.loss}`} />
            <StatTile label={m.goals} value={`${diff > 0 ? "+" : ""}${diff}`} sub={`${season.goalsFor}-${season.goalsAgainst}`} />
          </div>
          <Card className="p-5">
            <SeasonChart matches={season.matches} color={team.primary_color} />
          </Card>
          <Card>
            <CardHeader title={m.result} />
            <div className="overflow-x-auto px-5 pb-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{m.date}</th>
                    <th className="py-2 pr-3 font-medium">{m.opponent}</th>
                    <th className="py-2 pr-3 font-medium">{m.score}</th>
                    <th className="py-2 text-right font-medium">{m.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {season.matches.toReversed().map((match) => (
                    <tr key={match.date}>
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{longDate(match.date)}</td>
                      <td className="py-2 pr-3">
                        {match.opponent}
                        {match.home !== null && <span className="ml-1 text-xs text-slate-400">({match.home ? messages.evaluationsPage.home : messages.evaluationsPage.away})</span>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                        <span className="mr-2 inline-block w-5 rounded text-center text-xs font-bold text-white" style={{ backgroundColor: OUTCOME_COLORS[match.outcome] }}>
                          {letters[match.outcome]}
                        </span>
                        {match.goalsFor}-{match.goalsAgainst}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">{match.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
