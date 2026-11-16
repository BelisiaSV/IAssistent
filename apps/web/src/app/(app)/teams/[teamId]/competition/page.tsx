import { Card, CardHeader, EmptyState } from "@/components/card";
import { formOf, matchesOf, nextMatchOf, opponentOf, outcomeFor } from "@/lib/competition/team";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { OUTCOME_COLORS } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";
import { longDate, shortDate, todayInBelgium, weekdayName } from "@/lib/weeks/dates";

import { StandingsTable } from "./standings-table";

const m = messages.competition.page;
const letters = messages.dashboard.form.letter;

/** Competitie: standings, calendar and results of the divisions of the team, from the exports of Voetbal Vlaanderen. */
export default async function CompetitionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const own = team.federation_team;
  if (!own || !team.federation_divisions.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <EmptyState text={m.notLinked} />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: matches }, { data: standings }] = await Promise.all([
    supabase.from("competition_matches").select("*").in("division", team.federation_divisions).order("match_date"),
    supabase.from("competition_standings").select("*").in("division", team.federation_divisions).order("position"),
  ]);
  const all = matches ?? [];
  const today = todayInBelgium();
  const mine = matchesOf(all, own);
  const next = nextMatchOf(all, own, today);
  const opponent = next ? opponentOf(next, own) : null;
  const opponentRow = opponent ? (standings ?? []).find((s) => s.team === opponent && s.period === 0 && s.division === next!.division) : undefined;
  const updated = [...all.map((x) => x.imported_at), ...(standings ?? []).map((s) => s.imported_at)].sort().at(-1);
  const upcoming = mine.filter((x) => x.home_goals === null && x.match_date >= today);
  const played = mine.filter((x) => !upcoming.includes(x)).reverse();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        {updated && <p className="text-xs text-slate-500">{m.updated(longDate(updated.slice(0, 10)))}</p>}
      </div>

      {!all.length && !(standings ?? []).length ? (
        <EmptyState text={m.noData} />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-5">
            <Card>
              <CardHeader title={m.next} />
              <div className="space-y-3 px-5 pb-5">
                {next ? (
                  <>
                    <p className="text-sm text-slate-500">
                      {weekdayName(next.match_date)} {longDate(next.match_date)}
                      {next.kickoff && ` · ${next.kickoff}`} · {m.division(next.division)}
                    </p>
                    <p className="text-lg font-bold">
                      {next.home} – {next.away}
                    </p>
                    {(next.referee || next.assistant_1) && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                        {next.referee && (
                          <>
                            <dt className="text-slate-500">{m.referee}</dt>
                            <dd>{next.referee}</dd>
                          </>
                        )}
                        {(next.assistant_1 || next.assistant_2) && (
                          <>
                            <dt className="text-slate-500">{m.assistants}</dt>
                            <dd>{[next.assistant_1, next.assistant_2].filter(Boolean).join(", ")}</dd>
                          </>
                        )}
                      </dl>
                    )}
                    {opponent && (
                      <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold text-slate-500">{m.opponentForm(opponent)}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {formOf(all, opponent).map((o, i) => (
                            <span key={i} className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white" style={{ backgroundColor: OUTCOME_COLORS[o] }}>
                              {letters[o]}
                            </span>
                          ))}
                          {opponentRow && <span className="text-sm text-slate-600">{m.opponentPlace(opponentRow.position, opponentRow.points)}</span>}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">{m.noUpcoming}</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title={m.calendar} />
              <div className="px-5 pb-5">
                {upcoming.length > 0 && <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">{m.upcoming}</p>}
                <ul className="mb-4 divide-y divide-slate-100">
                  {upcoming.map((x) => (
                    <MatchLine key={`${x.division}${x.match_date}${x.home}`} match={x} own={own} />
                  ))}
                </ul>
                {played.length > 0 && <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">{m.played}</p>}
                <ul className="divide-y divide-slate-100">
                  {played.map((x) => (
                    <MatchLine key={`${x.division}${x.match_date}${x.home}`} match={x} own={own} />
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            {team.federation_divisions.map((division) => {
              const rows = (standings ?? []).filter((s) => s.division === division);
              if (!rows.length) return null;
              return (
                <Card key={division}>
                  <CardHeader title={`${m.standings} · ${m.division(division)}`} />
                  <div className="px-5 pb-5">
                    <StandingsTable
                      own={own}
                      rows={rows.map((s) => ({
                        period: s.period,
                        position: s.position,
                        team: s.team,
                        played: s.played,
                        won: s.won,
                        drawn: s.drawn,
                        lost: s.lost,
                        goalsFor: s.goals_for,
                        goalsAgainst: s.goals_against,
                        points: s.points,
                        form: formOf(all.filter((x) => x.division === division), s.team),
                      }))}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MatchLine({ match, own }: { match: Parameters<typeof outcomeFor>[0]; own: string }) {
  const outcome = outcomeFor(match, own);
  const status = match.status ? (m.status[match.status] ?? match.status) : null;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <span className="w-20 shrink-0 text-slate-500 tabular-nums">
        {shortDate(match.match_date)}
        {match.kickoff && <span className="block text-xs">{match.kickoff}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className={match.home === own ? "font-semibold" : ""}>{match.home}</span> –{" "}
        <span className={match.away === own ? "font-semibold" : ""}>{match.away}</span>
        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{match.division}</span>
        {status && (
          <span title={match.status ?? undefined} className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            {status}
          </span>
        )}
      </span>
      {match.home_goals !== null && match.away_goals !== null && (
        <span className="flex items-center gap-2 font-semibold tabular-nums">
          {match.home_goals}-{match.away_goals}
          {outcome && (
            <span className="flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white" style={{ backgroundColor: OUTCOME_COLORS[outcome] }}>
              {letters[outcome]}
            </span>
          )}
        </span>
      )}
    </li>
  );
}
