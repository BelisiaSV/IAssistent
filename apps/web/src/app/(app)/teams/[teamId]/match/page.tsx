import Link from "next/link";

import { Card, CardHeader, EmptyState, StatTile } from "@/components/card";
import { OpponentPitch } from "@/components/next-match/opponent-pitch";
import { SeasonChart } from "@/components/reports/season-chart";
import { messages } from "@/lib/messages";
import { loadNextMatch } from "@/lib/next-match/load";
import { OUTCOME_COLORS } from "@/lib/teams/dashboard";
import { longDate, mondayOf, shortDate, weekdayName } from "@/lib/weeks/dates";

const m = messages.nextMatchPage;
const letters = messages.dashboard.form.letter as Record<string, string>;

/**
 * Wedstrijdanalyse → Volgende wedstrijd: the opponent of the next match at a
 * glance (logo, standing, form, season, lineup). The plans of the staff are
 * in the Staff Room and the Microcyclus.
 */
export default async function NextMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ datum?: string }>;
}) {
  const [{ teamId }, { datum }] = await Promise.all([params, searchParams]);
  const { presentation: data, standing, season, fiche } = await loadNextMatch(teamId, datum);
  const base = `/teams/${teamId}`;
  const match = data.match;
  if (!match || !data.opponent) return <EmptyState text={m.noMatch} href={`${base}/staff-room`} link={messages.nav.staffRoom} />;
  const opponent = data.opponent;
  const address = match.home ? null : fiche?.address;
  const link = "rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50";

  return (
    <div className="space-y-6">
      {data.matches.length > 1 && (
        <nav aria-label={messages.presentation.match} className="flex flex-wrap gap-2">
          {data.matches.map((x) => (
            <Link
              key={x.date}
              href={`?datum=${x.date}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${x.date === match.date ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
            >
              {shortDate(x.date)} · {x.opponent}
            </Link>
          ))}
        </nav>
      )}

      <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-2xl bg-white/90 p-3">
          {opponent.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={opponent.logoUrl} alt={opponent.name} className="h-full w-full object-contain" />
          ) : (
            <span className="text-center text-xs text-slate-500">{m.logoMissing}</span>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold tracking-[0.15em] text-brand uppercase">{match.home ? m.home : m.away}</p>
          <h1 className="text-3xl font-bold tracking-tight">{opponent.name}</h1>
          <p className="text-slate-600">
            {weekdayName(match.date)} {longDate(match.date)}
            {match.start && ` · ${match.start}`}
          </p>
          {address && <p className="text-sm text-slate-500">{address}</p>}
          {fiche?.coach_name && <p className="text-sm text-slate-500">{m.coach(fiche.coach_name)}</p>}
        </div>
      </Card>

      {!standing && !season.length ? (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">{m.noCompetition}</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title={m.standingTitle} />
            <div className="grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3">
              {standing && (
                <>
                  <StatTile label={m.position} value={standing.position} sub={m.of(standing.teams)} />
                  <StatTile label={m.points} value={standing.points} />
                  <StatTile label={m.played} value={standing.played} />
                  <StatTile label={m.record} value={`${standing.won}-${standing.drawn}-${standing.lost}`} />
                  <StatTile label={m.goals} value={`${standing.goalsFor} – ${standing.goalsAgainst}`} />
                </>
              )}
            </div>
            {data.stats && data.stats.last.length > 0 && (
              <>
                <CardHeader title={m.formTitle} hint={m.formHint} />
                <ul className="flex flex-wrap gap-3 px-5 pb-5">
                  {data.stats.last.map((r, i) => (
                    <li key={i} className="flex w-20 flex-col items-center gap-1 text-center">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ backgroundColor: OUTCOME_COLORS[r.outcome] }}
                      >
                        {letters[r.outcome]}
                      </span>
                      {r.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.logoUrl} alt="" className="h-8 w-8 object-contain" />
                      )}
                      <span className="line-clamp-2 text-[11px] text-slate-500">{r.opponent}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          <Card>
            <CardHeader title={m.seasonTitle} hint={m.seasonHint} />
            <div className="px-5 pb-5">{season.length > 0 && <SeasonChart matches={season} color={opponent.shirt ?? "#94a3b8"} />}</div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title={m.lineupTitle} hint={data.opponentLineup ? m.lineupHint(data.opponentLineup.formation) : undefined} />
        <div className="px-5 pb-5">
          {data.opponentLineup ? (
            <OpponentPitch lineup={data.opponentLineup} shirt={opponent.shirt} trim={opponent.trim} />
          ) : (
            <EmptyState text={m.noLineup} href={fiche ? `${base}/opponents/${fiche.id}` : `${base}/opponents`} link={m.fillLineup} />
          )}
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href={`${base}/presentation?datum=${match.date}`} className={link}>
          {m.links.presentation}
        </Link>
        {fiche && (
          <Link href={`${base}/opponents/${fiche.id}`} className={link}>
            {m.links.opponent}
          </Link>
        )}
        <Link href={`${base}/weeks/${mondayOf(match.date)}?menu=match#match`} className={link}>
          {m.links.preparation}
        </Link>
      </div>
    </div>
  );
}
