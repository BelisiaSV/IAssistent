import Link from "next/link";
import type { ReactNode } from "react";

import { KitToken } from "@/components/dashboard/kit-token";
import { RoleFigure } from "@/components/dashboard/role-figure";
import { SeasonChart } from "@/components/dashboard/season-chart";
import { themeForTeam } from "@/lib/animation/team-theme";
import { messages } from "@/lib/messages";
import { readableOn, shade, withAlpha } from "@/lib/proposals/overview";
import { daysUntil, type NextMatch, OUTCOME_COLORS, type PlayedMatch, type SeasonResults } from "@/lib/teams/dashboard";
import { longDate, shortDate } from "@/lib/weeks/dates";

const m = messages.dashboard;

export interface DashboardRole {
  id: string;
  name: string;
  goal: string | null;
  status: "active" | "off" | "soon";
}

export interface DashboardProps {
  team: {
    id: string;
    clubName: string;
    primaryColor: string;
    homeAddress: string | null;
    competitionStart: string | null;
    animationSettings: unknown;
  };
  logoUrl: string | null;
  today: string;
  next: NextMatch | null;
  opponent: { id: string; address: string | null; coachName: string | null } | null;
  season: SeasonResults;
  /** Last five results, newest first. */
  form: PlayedMatch[];
  roles: DashboardRole[];
}

/** The team at a glance: next match, form, season, kits and staff. */
export function TeamDashboard({ team, logoUrl, today, next, opponent, season, form, roles }: DashboardProps) {
  const { theme, settings } = themeForTeam(team.animationSettings);
  const primary = team.primaryColor;
  // A light team colour is too faint for lines and text on white: use a darker shade.
  const ink = readableOn(primary) === "#ffffff" ? primary : shade(primary, 0.5);
  const base = `/teams/${team.id}`;
  const seasonStart = team.competitionStart;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Next match */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-2">
        <CardHeader title={m.nextMatch.title} />
        {!next ? (
          <Empty text={m.nextMatch.none} href={`${base}/weeks`} link={m.nextMatch.plan} />
        ) : (
          <div className="space-y-5 px-5 pb-5">
            <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-5 sm:px-6" style={{ backgroundColor: withAlpha(primary, 0.07) }}>
              <Side
                name={next.home ? team.clubName : next.opponent}
                crest={next.home ? <Crest logoUrl={logoUrl} name={team.clubName} color={primary} /> : <Crest name={next.opponent} color="#475569" />}
              />
              <div className="shrink-0 text-center">
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase"
                  style={{ backgroundColor: next.home ? primary : "#334155", color: next.home ? readableOn(primary) : "#fff" }}
                >
                  {next.home ? m.nextMatch.home : m.nextMatch.away}
                </span>
                <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 tabular-nums sm:text-3xl">{next.start ?? "vs"}</p>
                <p className="text-xs font-semibold text-slate-500">{countdown(daysUntil(next.date, today))}</p>
              </div>
              <Side
                name={next.home ? next.opponent : team.clubName}
                crest={next.home ? <Crest name={next.opponent} color="#475569" /> : <Crest logoUrl={logoUrl} name={team.clubName} color={primary} />}
              />
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Fact label={longDate(next.date)} value={next.start ? `${m.nextMatch.kickOff} ${next.start}` : m.nextMatch.noTime} />
              <AddressFact address={next.home ? team.homeAddress : (opponent?.address ?? null)} home={next.home} />
              <Fact label={m.nextMatch.coach} value={opponent?.coachName ?? m.nextMatch.noCoach} muted={!opponent?.coachName} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`${base}/weeks/${next.weekStart}`} color={primary}>
                {m.nextMatch.week}
              </ButtonLink>
              {opponent && (
                <ButtonLink href={`${base}/opponents/${opponent.id}`} subtle>
                  {m.nextMatch.fiche}
                </ButtonLink>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Form: last five results */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <CardHeader title={m.form.title} hint={m.form.hint} />
        {!form.length ? (
          <Empty text={m.form.none} href={`${base}/weeks`} link={m.nextMatch.plan} />
        ) : (
          <div className="space-y-4 px-5 pb-5">
            <div className="flex gap-1.5">
              {[...form].reverse().map((r) => (
                <OutcomeBadge key={r.date} outcome={r.outcome} large />
              ))}
            </div>
            <ul className="divide-y divide-slate-100">
              {form.map((r) => (
                <ResultRow key={r.date} match={r} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Season: running points */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-2">
        <CardHeader title={m.season.title} hint={seasonStart ? m.season.since(shortDate(seasonStart)) : m.season.hint} />
        {!season.matches.length ? (
          <Empty text={m.season.none} />
        ) : (
          <div className="space-y-4 px-5 pb-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label={m.season.points} value={season.points} ink={ink} strong />
              <Stat label={m.season.played} value={season.matches.length} />
              {(["win", "draw", "loss"] as const).map((o) => (
                <Stat key={o} label={m.form.outcome[o]} value={season.counts[o]} dot={OUTCOME_COLORS[o]} />
              ))}
              <Stat label={m.season.goals} value={signed(season.goalsFor - season.goalsAgainst)} sub={`${season.goalsFor}-${season.goalsAgainst}`} />
            </div>
            <div className="-mx-2 overflow-x-auto px-2">
              <div className="min-w-[520px]">
                <SeasonChart matches={season.matches} color={ink} />
              </div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-500 hover:text-slate-700">{m.season.table}</summary>
              <table className="mt-2 w-full text-left">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 font-medium">{m.season.date}</th>
                    <th className="py-1 font-medium">{m.season.opponent}</th>
                    <th className="py-1 text-right font-medium">{m.season.score}</th>
                    <th className="py-1 text-right font-medium">{m.season.points}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {season.matches.map((r) => (
                    <tr key={r.date}>
                      <td className="py-1.5">{shortDate(r.date)}</td>
                      <td className="py-1.5">{r.opponent}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.goalsFor}-{r.goalsAgainst} <OutcomeBadge outcome={r.outcome} />
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </section>

      {/* Kits: the tokens of the animations */}
      <section className="flex flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <CardHeader title={m.kits.title} hint={m.kits.hint} />
        <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
          <div
            className="relative grid flex-1 grid-cols-5 place-items-center gap-1 overflow-hidden rounded-xl px-2 py-6"
            style={{
              backgroundColor: theme.gras[0],
              backgroundImage: `repeating-linear-gradient(90deg, ${theme.gras[1]} 0 24px, transparent 24px 48px)`,
            }}
          >
            <span aria-hidden className="absolute inset-y-0 left-1/2 w-px" style={{ backgroundColor: theme.lijnen, opacity: 0.35 }} />
            <span
              aria-hidden
              className="absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ borderColor: theme.lijnen, opacity: 0.35 }}
            />
            {(
              [
                [theme.teams.eigen, "7", m.kits.own],
                [theme.doelman.eigen ?? theme.teams.eigen, "1", m.kits.ownKeeper],
                [theme.teams.tegenstander, "9", m.kits.opponent],
                [theme.doelman.tegenstander ?? theme.teams.tegenstander, "1", m.kits.opponentKeeper],
                [theme.teams.neutraal, "", m.kits.neutral],
              ] as const
            ).map(([color, label, name]) => (
              <figure key={name + color} className="relative flex flex-col items-center gap-1">
                <KitToken color={color} label={label} size={46} />
                <figcaption className="text-center text-[10px] leading-tight font-medium" style={{ color: theme.lijnen }}>
                  {name}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-sm text-slate-600">{m.kits.style[settings.stijl]}</p>
          <div className="mt-auto">
            <ButtonLink href={`${base}/settings#weergave`} subtle>
              {m.kits.edit}
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Staff */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-span-3">
        <CardHeader title={m.staff.title} hint={m.staff.hint} action={<ButtonLink href={`${base}/weeks`} color={primary}>{m.staff.open}</ButtonLink>} />
        <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((role) => {
            const status = role.status;
            return (
              <li key={role.id} className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ring-slate-200 ${status === "soon" ? "bg-slate-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <RoleFigure role={role.id} color={status === "soon" ? "#94a3b8" : ink} />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{role.name}</p>
                    <StatusPill status={status} />
                  </div>
                </div>
                {role.goal && status !== "soon" && <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">{role.goal}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function countdown(days: number) {
  return days <= 0 ? m.nextMatch.today : days === 1 ? m.nextMatch.tomorrow : m.nextMatch.inDays(days);
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="text-xs font-bold tracking-[0.15em] text-slate-500 uppercase">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function Empty({ text, href, link }: { text: string; href?: string; link?: string }) {
  return (
    <div className="px-5 pb-5">
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
        <p>{text}</p>
        {href && link && (
          <Link href={href} className="mt-2 inline-block font-medium text-brand hover:text-brand-dark">
            {link} →
          </Link>
        )}
      </div>
    </div>
  );
}

function Crest({ logoUrl, name, color }: { logoUrl?: string | null; name: string; color: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-sm ring-1 ring-slate-200 sm:h-16 sm:w-16" />;
  }
  return (
    <span
      aria-hidden
      className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black shadow-sm sm:h-16 sm:w-16"
      style={{ backgroundColor: color, color: readableOn(color) }}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

function Side({ name, crest }: { name: string; crest: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {crest}
      <p className="line-clamp-2 text-sm font-bold text-slate-900 sm:text-base">{name}</p>
    </div>
  );
}

function Fact({ label, value, muted = false }: { label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 first-letter:uppercase">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${muted ? "text-slate-400" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}

function AddressFact({ address, home }: { address: string | null; home: boolean }) {
  if (!address) {
    return <Fact label={m.nextMatch.address} value={home ? m.nextMatch.addHomeAddress : m.nextMatch.addAwayAddress} muted />;
  }
  return (
    <Fact
      label={m.nextMatch.address}
      value={
        <span>
          {address}{" "}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-brand hover:text-brand-dark"
          >
            {m.nextMatch.route} ↗
          </a>
        </span>
      }
    />
  );
}

function ButtonLink({ href, children, color, subtle = false }: { href: string; children: ReactNode; color?: string; subtle?: boolean }) {
  if (subtle || !color) {
    return (
      <Link href={href} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
        {children}
      </Link>
    );
  }
  return (
    <Link href={href} className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm hover:opacity-90" style={{ backgroundColor: color, color: readableOn(color) }}>
      {children}
    </Link>
  );
}

function OutcomeBadge({ outcome, large = false }: { outcome: PlayedMatch["outcome"]; large?: boolean }) {
  return (
    <span
      title={m.form.outcome[outcome]}
      className={`inline-flex items-center justify-center rounded-md font-bold text-white ${large ? "h-9 w-9 text-sm" : "h-5 w-5 text-[11px]"}`}
      style={{ backgroundColor: OUTCOME_COLORS[outcome] }}
    >
      {m.form.letter[outcome]}
    </span>
  );
}

function ResultRow({ match }: { match: PlayedMatch }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <OutcomeBadge outcome={match.outcome} />
      <span className="w-14 shrink-0 text-xs text-slate-500">{shortDate(match.date)}</span>
      <span className="min-w-0 flex-1 truncate">
        {match.opponent}
        {match.home !== null && <span className="ml-1 text-xs text-slate-400">({match.home ? m.nextMatch.home : m.nextMatch.away})</span>}
      </span>
      <span className="font-bold tabular-nums">
        {match.goalsFor}-{match.goalsAgainst}
      </span>
    </li>
  );
}

function Stat({ label, value, sub, dot, ink, strong = false }: { label: string; value: ReactNode; sub?: string; dot?: string; ink?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${strong ? "" : "bg-slate-50"}`} style={strong && ink ? { backgroundColor: withAlpha(ink, 0.08) } : undefined}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        {dot && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </p>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums" style={strong && ink ? { color: ink } : undefined}>
        {value}
        {sub && <span className="ml-1 text-xs font-medium text-slate-400">{sub}</span>}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: "active" | "off" | "soon" }) {
  const style = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    off: "bg-amber-50 text-amber-700 ring-amber-200",
    soon: "bg-slate-100 text-slate-500 ring-slate-200",
  }[status];
  return (
    <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : status === "off" ? "bg-amber-500" : "bg-slate-400"}`} />
      {m.staff.status[status]}
    </span>
  );
}
