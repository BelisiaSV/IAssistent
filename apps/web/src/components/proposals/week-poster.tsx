import type { ReactNode } from "react";

import { documentFonts } from "@/lib/fonts";
import { messages } from "@/lib/messages";
import { INTENSITY_MAX, readableOn, shade, withAlpha, type OverviewDay, type WeekOverview } from "@/lib/proposals/overview";
import { isoWeek, shortDate, weekdayName } from "@/lib/weeks/dates";

import { DocIcon, type DocIconName } from "./doc-icons";

const p = messages.poster;

/** Size of the poster: A4 landscape at 96 dpi, so it prints on one page. */
export const POSTER_WIDTH = 1123;
export const POSTER_HEIGHT = 794;

interface PosterTeam {
  clubName: string;
  teamName: string;
  primary: string;
  secondary: string;
  logoUrl: string | null;
}

const display = "font-[family-name:var(--font-display)]";

/** Diagonal pinstripes over the team colour, for the header bands. */
export function stripes(color: string) {
  return {
    backgroundColor: color,
    backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 14px), linear-gradient(120deg, ${color} 0%, ${shade(color, 0.35)} 100%)`,
  };
}

/**
 * The week at a glance for the players, in the team's colours: a card per
 * day with goal, content, focus, time and intensity, and the key message.
 */
export function WeekPoster({ id, overview, team, weekStart }: { id: string; overview: WeekOverview; team: PosterTeam; weekStart: string }) {
  const onPrimary = readableOn(team.primary);
  const first = overview.days[0]?.datum ?? weekStart;
  const last = overview.days.at(-1)?.datum ?? weekStart;

  return (
    <div
      id={id}
      lang="nl"
      className={`${documentFonts} flex flex-col overflow-hidden bg-slate-100 text-slate-900 [font-family:var(--font-body)]`}
      style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}
    >
      <header className="relative flex items-center gap-5 px-8 py-5" style={{ ...stripes(team.primary), color: onPrimary }}>
        {team.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" crossOrigin="anonymous" className="h-[72px] w-[72px] rounded-2xl bg-white object-contain p-1.5 shadow-lg" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase opacity-75">
            {team.clubName} · {team.teamName}
          </p>
          <div className="flex items-baseline gap-3">
            <h1 className={`${display} text-[44px] leading-none font-extrabold tracking-wide uppercase`}>{p.title}</h1>
            <span
              className={`${display} rounded-md px-2 py-0.5 text-lg font-bold tracking-wider uppercase`}
              style={{ backgroundColor: team.secondary, color: readableOn(team.secondary) }}
            >
              {p.weekNumber(isoWeek(first))}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm opacity-85">
            <DocIcon name="calendar" className="h-4 w-4" />
            {p.week(shortDate(first), shortDate(last))}
          </p>
        </div>
        {overview.keyMessage && (
          <div className="max-w-[440px] rounded-2xl border border-white/25 bg-white/10 px-5 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase" style={{ color: team.secondary }}>
              {p.keyMessage}
            </p>
            <p className="text-[17px] leading-snug font-semibold">{overview.keyMessage}</p>
          </div>
        )}
      </header>

      <div
        className="grid flex-1 gap-2.5 px-5 pt-4 pb-3"
        style={{ gridTemplateColumns: overview.days.map((d) => (d.soort === "rust" ? "minmax(0, 0.55fr)" : "minmax(0, 1fr)")).join(" ") }}
      >
        {overview.days.map((d) => (
          <DayCard key={d.datum} day={d} team={team} />
        ))}
      </div>

      <footer className="flex items-center justify-between px-6 pb-3 text-[10px] font-medium tracking-wider text-slate-500 uppercase">
        <span className="flex items-center gap-2">
          {p.rows.intensity}
          <Bars value={3} color={team.primary} small />
          <span className="normal-case">{p.legend}</span>
        </span>
        <span>
          {team.clubName} · {team.teamName}
        </span>
      </footer>
    </div>
  );
}

function DayCard({ day, team }: { day: OverviewDay; team: PosterTeam }) {
  const match = day.soort === "wedstrijd";
  const rest = day.soort === "rust";
  const band = match ? team.secondary : rest ? "#e2e8f0" : team.primary;
  const onBand = readableOn(band);

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="px-3 pt-3 pb-2.5" style={rest ? { backgroundColor: band, color: "#475569" } : { ...stripes(band), color: onBand }}>
        <p className={`${display} text-[32px] leading-none font-extrabold`}>{day.md ?? "–"}</p>
        <p className="mt-1 text-[11px] font-bold tracking-[0.15em] uppercase">{weekdayName(day.datum)}</p>
        <p className="text-[10px] opacity-75">{shortDate(day.datum)}</p>
      </div>

      {rest ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
          <DocIcon name="moon" className="h-7 w-7" />
          <p className={`${display} text-lg font-bold tracking-wider uppercase`}>{p.rest}</p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 break-words hyphens-auto">
          {match && day.match ? (
            <div className="space-y-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
                style={{ backgroundColor: withAlpha(team.secondary, 0.2), color: shade(team.secondary, 0.55) }}
              >
                <DocIcon name={day.match.home ? "home" : "plane"} className="h-3 w-3" />
                {day.match.home ? p.home : p.away}
              </span>
              <p className={`${display} text-[26px] leading-[1.05] font-bold`}>{day.match.opponent}</p>
              <DocIcon name="ball" className="h-8 w-8 text-slate-300" />
            </div>
          ) : (
            <>
              <Section icon="target" label={p.rows.goal}>
                <p className="text-[15.5px] leading-snug font-bold">{day.objective}</p>
              </Section>
              {day.content.length > 0 && (
                <Section icon="list" label={p.rows.content}>
                  <ul className="space-y-1.5">
                    {day.content.map((c, i) => (
                      <li key={c} className="flex gap-2 text-[13.5px] leading-snug">
                        <span
                          className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                          style={{ backgroundColor: withAlpha(team.primary, 0.12), color: team.primary }}
                        >
                          {i + 1}
                        </span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {day.focus && (
                <Section icon="compass" label={p.rows.focus}>
                  <span
                    className="inline-block rounded-lg px-2 py-1 text-[12.5px] leading-snug font-semibold"
                    style={{ backgroundColor: withAlpha(team.primary, 0.1), color: team.primary }}
                  >
                    {day.focus}
                  </span>
                </Section>
              )}
            </>
          )}

          <div className="mt-auto space-y-2 border-t border-slate-100 pt-2.5">
            {(day.start || day.durationMin) && (
              <p className="flex items-center gap-1.5 text-[13px] font-bold tabular-nums">
                <DocIcon name="clock" className="h-4 w-4 text-slate-400" />
                {[day.start, day.durationMin ? p.duration(day.durationMin) : null].filter(Boolean).join(" · ")}
              </p>
            )}
            <div>
              <p className="mb-1 text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">{match ? p.match : day.load}</p>
              <Bars value={day.intensity} color={match ? team.secondary : team.primary} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function Section({ icon, label, children }: { icon: DocIconName; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.15em] text-slate-400 uppercase">
        <DocIcon name={icon} className="h-3 w-3" />
        {label}
      </p>
      {children}
    </div>
  );
}

function Bars({ value, color, small = false }: { value: number; color: string; small?: boolean }) {
  return (
    <span className={`flex gap-0.5 ${small ? "w-14" : "w-full"}`} aria-label={`${value}/${INTENSITY_MAX}`}>
      {Array.from({ length: INTENSITY_MAX }, (_, i) => (
        <span
          key={i}
          className={`flex-1 rounded-full ${small ? "h-1.5" : "h-2"}`}
          style={{ backgroundColor: i < value ? withAlpha(color, 0.45 + (0.55 * (i + 1)) / INTENSITY_MAX) : "#e2e8f0" }}
        />
      ))}
    </span>
  );
}
