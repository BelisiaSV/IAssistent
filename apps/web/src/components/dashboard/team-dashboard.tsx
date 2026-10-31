import type { FormationSlot } from "@iassistent/staff-engine/content";
import Link from "next/link";
import type { ReactNode } from "react";

import { type LineupSpot, LineupPitch } from "@/components/dashboard/lineup-pitch";
import { type PitchPlayer, SquadPitch } from "@/components/dashboard/squad-pitch";
import { messages } from "@/lib/messages";
import { STATUS_COLORS } from "@/lib/players/status";
import { PLAYER_STATUSES, type PlayerStatus } from "@/lib/players/validation";
import { readableOn } from "@/lib/proposals/overview";
import { daysUntil, type NextMatch, OUTCOME_COLORS, type PlayedMatch } from "@/lib/teams/dashboard";
import type { DayPlan } from "@/lib/teams/microcycle";
import { isoWeek, shortDate, weekdayName } from "@/lib/weeks/dates";

const m = messages.dashboard;

export interface DashboardProps {
  team: {
    id: string;
    name: string;
    clubName: string;
    season: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  logoUrl: string | null;
  today: string;
  next: NextMatch | null;
  /** Where the next match is played and who coaches the opponent. */
  venue: { address: string | null; coach: string | null } | null;
  /** Last five results, newest first, and the points of the season. */
  form: { matches: PlayedMatch[]; points: number; played: number };
  microcycle: {
    weekStart: string;
    weekType: string | null;
    /** Monday to Sunday of this week. */
    week: DayPlan[];
    /** Today and the next days. */
    upcoming: DayPlan[];
  };
  squad: {
    canEdit: boolean;
    formation: string;
    slots: { slot: FormationSlot; players: PitchPlayer[] }[];
    unplaced: PitchPlayer[];
    counts: Record<PlayerStatus, number>;
    total: number;
    keeperColor: string;
  };
  lineup: {
    id: string;
    title: string;
    formation: string;
    spots: LineupSpot[];
    bench: { id: string; number: number | null; name: string; position: string | null; status: PlayerStatus }[];
  } | null;
}

/**
 * The team at a glance, on one screen: identity and kit, next match, form and
 * microcycle on top; the squad on the pitch with the days of the microcycle,
 * the last lineup and the availability below.
 */
export function TeamDashboard({ team, logoUrl, today, next, venue, form, microcycle, squad, lineup }: DashboardProps) {
  const primary = team.primaryColor;
  const base = `/teams/${team.id}`;
  const todayPlan = microcycle.upcoming[0];
  const sessions = microcycle.week.filter((d) => d.training);
  const minutes = sessions.reduce((sum, d) => sum + (d.training?.minutes ?? 0), 0);
  const maxMinutes = Math.max(90, ...microcycle.week.map((d) => d.training?.minutes ?? (d.match ? 90 : 0)));

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-[#0b1220] px-3 py-4 text-slate-100 sm:-mx-6 sm:-my-8 sm:px-4 lg:-mx-8 lg:px-5">
      <div className="space-y-4">
        {/* Top row: identity and the three key facts. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel className="flex items-center gap-4 p-4 xl:col-span-4">
            <Tile>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-16 w-16 object-contain" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl font-black"
                  style={{ backgroundColor: primary, color: readableOn(primary) }}
                >
                  {team.clubName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </Tile>
            <div className="min-w-0">
              <Eyebrow>{m.identity.title}</Eyebrow>
              <p className="truncate text-2xl font-extrabold tracking-tight text-white">{team.clubName}</p>
              <p className="truncate text-xs text-slate-400">
                {team.name}
                {team.season ? ` · ${team.season}` : ""}
              </p>
              <Link href={`${base}/settings`} className="mt-1.5 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 hover:bg-white/15">
                {m.identity.edit}
              </Link>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:col-span-8">
            <Fact
              eyebrow={m.nextMatch.title}
              title={next ? next.opponent : m.nextMatch.noneShort}
              sub={next ? [shortDate(next.date), next.home ? m.nextMatch.home : m.nextMatch.away, next.start].filter(Boolean).join(" · ") : m.nextMatch.noneHint}
              badge={next ? countdown(daysUntil(next.date, today)) : undefined}
              href={next ? `${base}/weeks/${next.weekStart}` : `${base}/weeks`}
            >
              {venue?.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[11px] text-sky-300 hover:underline"
                >
                  {venue.address} ↗
                </a>
              )}
              {venue?.coach && <p className="truncate text-[11px] text-slate-400">{m.nextMatch.coach(venue.coach)}</p>}
            </Fact>
            <Panel className="p-4">
              <Eyebrow>{m.form.title}</Eyebrow>
              {form.matches.length ? (
                <>
                  <div className="mt-2 flex gap-1">
                    {[...form.matches].reverse().map((r) => (
                      <span
                        key={r.date}
                        title={`${shortDate(r.date)} · ${r.opponent} · ${r.goalsFor}-${r.goalsAgainst}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                        style={{ backgroundColor: OUTCOME_COLORS[r.outcome] }}
                      >
                        {m.form.letter[r.outcome]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">{m.form.season(form.points, form.played)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm font-semibold text-slate-300">{m.form.noneShort}</p>
              )}
            </Panel>
            <Fact
              eyebrow={m.microcycle.title}
              title={m.microcycle.week(isoWeek(microcycle.weekStart), microcycle.weekType)}
              sub={sessions.length ? m.microcycle.sessions(sessions.length, minutes) : m.microcycle.none}
              href={`${base}/weeks/${microcycle.weekStart}`}
            />
          </div>
        </div>

        {/* Main row. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel className="xl:col-span-8">
            <PanelHeader
              title={m.squad.title}
              aside={
                <>
                  <Pill>{m.squad.formationPill(squad.formation)}</Pill>
                  <HeaderLink href={squad.canEdit ? `${base}/settings` : `${base}/players`}>
                    {squad.canEdit ? m.squad.changeFormation : m.availability.open}
                  </HeaderLink>
                </>
              }
            />
            <div className="@container px-4 pb-4">
            <div className="grid gap-4 @[640px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                {squad.total === 0 ? (
                  <EmptyDark text={m.squad.none} href={squad.canEdit ? `${base}/players/new` : undefined} link={m.squad.addPlayers} />
                ) : (
                  <SquadPitch
                    teamId={team.id}
                    canEdit={squad.canEdit}
                    slots={squad.slots}
                    unplaced={squad.unplaced}
                    colors={{ primary, secondary: team.secondaryColor }}
                    keeperColor={squad.keeperColor}
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <SubPanel title={m.microcycle.today}>
                  {todayPlan && <DayBadge day={todayPlan} />}
                  <p className="mt-2 text-lg font-bold text-white">{todayPlan ? dayTitle(todayPlan) : m.microcycle.rest}</p>
                  <p className="text-xs text-slate-400">{todayPlan ? daySub(todayPlan) : ""}</p>
                </SubPanel>

                <SubPanel title={m.microcycle.next}>
                  <ul className="divide-y divide-white/5">
                    {microcycle.upcoming.slice(1, 5).map((d) => (
                      <li key={d.date} className="flex items-center gap-3 py-1.5 text-xs">
                        <span className="w-16 shrink-0 font-semibold text-slate-300 uppercase">{weekdayName(d.date).slice(0, 2)} {shortDate(d.date)}</span>
                        <span className="w-12 shrink-0">{d.md && <span className="rounded bg-white/10 px-1.5 py-0.5 font-bold text-slate-200">{d.md.code}</span>}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-300">{dayTitle(d)}</span>
                        <span className="shrink-0 text-slate-500 tabular-nums">{d.training ? m.microcycle.minutes(d.training.minutes) : d.match?.start ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </SubPanel>

                <SubPanel title={m.microcycle.duration} aside={minutes ? m.microcycle.minutes(minutes) : undefined}>
                  <div className="flex h-28 items-stretch gap-2">
                    {microcycle.week.map((d) => {
                      const value = d.training?.minutes ?? (d.match ? 90 : 0);
                      return (
                        <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${weekdayName(d.date)} · ${dayTitle(d)}`}>
                          <div className="relative flex w-full max-w-5 flex-1 items-end overflow-hidden rounded-full bg-white/5">
                            <div
                              className="w-full rounded-full"
                              style={{ height: `${(value / maxMinutes) * 100}%`, backgroundColor: d.match ? team.secondaryColor : "#22c55e", opacity: d.date < today ? 0.5 : 1 }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-white tabular-nums">{value || "—"}</span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase">{d.md?.code ?? weekdayName(d.date).slice(0, 2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </SubPanel>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label={m.microcycle.total} value={minutes ? m.microcycle.minutes(minutes) : "—"} />
                  <MiniStat label={m.microcycle.sessionsLabel} value={sessions.length || "—"} />
                </div>
              </div>
            </div>
            </div>
          </Panel>

          <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
            <Panel>
              <PanelHeader
                title={m.lineup.title}
                aside={lineup ? <Pill>{lineup.formation}</Pill> : undefined}
              />
              {lineup ? (
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 pb-4">
                  <Link href={`${base}/lineups/${lineup.id}`} className="block h-64" title={lineup.title}>
                    <LineupPitch spots={lineup.spots} color={primary} />
                  </Link>
                  <div className="min-w-0">
                    <p className="mb-1.5 truncate text-[11px] font-bold tracking-wider text-slate-400 uppercase">{m.lineup.bench}</p>
                    <ul className="space-y-1">
                      {lineup.bench.slice(0, 7).map((p) => (
                        <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1">
                          <span className="w-5 text-center text-[11px] font-black tabular-nums">{p.number ?? "–"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-semibold text-white">{p.name}</span>
                            {p.position && <span className="block text-[9px] text-slate-400">{p.position}</span>}
                          </span>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[p.status] }} />
                        </li>
                      ))}
                      {!lineup.bench.length && <li className="text-xs text-slate-500">—</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-4">
                  <EmptyDark text={m.lineup.none} href={`${base}/lineups`} link={m.lineup.open} />
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title={m.availability.title} aside={<HeaderLink href={`${base}/players`}>{m.availability.open}</HeaderLink>} />
              <div className="flex items-center gap-5 px-4 pb-3">
                <AvailabilityDonut counts={squad.counts} total={squad.total} />
                <ul className="flex-1 space-y-1.5 text-xs">
                  {PLAYER_STATUSES.map((s) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                      <span className="flex-1 text-slate-300">{messages.players.status[s]}</span>
                      <span className="font-bold text-white tabular-nums">{squad.counts[s]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
                {PLAYER_STATUSES.map((s) => (
                  <div key={s} className="rounded-xl bg-white/5 px-2.5 py-2">
                    <p className="truncate text-[9px] font-bold tracking-wider text-slate-400 uppercase">{messages.players.status[s]}</p>
                    <p className="text-lg font-black tabular-nums" style={{ color: s === "available" ? "#4ade80" : undefined }}>
                      {squad.counts[s]}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function countdown(days: number) {
  return days <= 0 ? m.nextMatch.today : days === 1 ? m.nextMatch.tomorrow : m.nextMatch.inDays(days);
}

function dayTitle(d: DayPlan) {
  if (d.match) return m.microcycle.match(d.match.opponent);
  if (d.training) return d.md ? d.md.naam : m.microcycle.training;
  return m.microcycle.rest;
}

function daySub(d: DayPlan) {
  if (d.match) return [d.match.home ? m.nextMatch.home : m.nextMatch.away, d.match.start].filter(Boolean).join(" · ");
  if (d.training) return m.microcycle.trainingAt(d.training.start, d.training.minutes);
  return m.microcycle.noTraining;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-[#111a2e] ring-1 ring-white/10 ${className}`}>{children}</section>;
}

function PanelHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}

function SubPanel({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-200">{title}</p>
        {aside && <p className="text-xs font-semibold text-slate-400">{aside}</p>}
      </div>
      {children}
    </div>
  );
}

function Tile({ children }: { children: ReactNode }) {
  return <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">{children}</div>;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">{children}</p>;
}

function Fact({ eyebrow, title, sub, badge, href, children }: { eyebrow: string; title: string; sub: string; badge?: string; href: string; children?: ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-[#111a2e] p-4 ring-1 ring-white/10 transition hover:ring-white/25">
      <div className="flex items-start justify-between gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        {badge && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{badge}</span>}
      </div>
      <Link href={href} className="mt-1.5 line-clamp-2 block text-base leading-snug font-bold text-white hover:underline">
        {title}
      </Link>
      <p className="truncate text-xs text-slate-400">{sub}</p>
      {children}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-slate-300 ring-1 ring-white/10">{children}</span>;
}

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold whitespace-nowrap text-white hover:bg-white/15">
      {children}
    </Link>
  );
}

function DayBadge({ day }: { day: DayPlan }) {
  return (
    <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
      {day.md?.code ?? `${weekdayName(day.date)} ${shortDate(day.date)}`}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
      <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function EmptyDark({ text, href, link }: { text: string; href?: string; link?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-slate-400">
      <p>{text}</p>
      {href && link && (
        <Link href={href} className="mt-2 inline-block font-semibold text-white hover:underline">
          {link} →
        </Link>
      )}
    </div>
  );
}

/** Ring with the share of available players, the other statuses as segments. */
function AvailabilityDonut({ counts, total }: { counts: Record<PlayerStatus, number>; total: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = total > 1 ? 1.5 : 0;
  const segments = PLAYER_STATUSES.map((s) => ({ s, len: total ? (counts[s] / total) * c : 0 }));
  const starts = segments.map((_, i) => segments.slice(0, i).reduce((sum, x) => sum + x.len, 0));
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
        {segments.map(({ s, len }, i) =>
          len ? (
            <circle
              key={s}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={STATUS_COLORS[s]}
              strokeWidth="11"
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
              strokeDashoffset={-starts[i]!}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white tabular-nums">
          {counts.available}/{total}
        </span>
        <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{m.availability.available}</span>
      </div>
    </div>
  );
}
