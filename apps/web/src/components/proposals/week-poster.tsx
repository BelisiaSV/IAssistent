import type { ReactNode } from "react";

import { messages } from "@/lib/messages";
import { INTENSITY_MAX, readableOn, type OverviewDay, type WeekOverview } from "@/lib/proposals/overview";
import { shortDate, weekdayName } from "@/lib/weeks/dates";

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

/**
 * The week at a glance for the players, in the team's colours: one column per
 * day with goal, content, focus, time and intensity.
 */
export function WeekPoster({ id, overview, team, weekStart }: { id: string; overview: WeekOverview; team: PosterTeam; weekStart: string }) {
  const onPrimary = readableOn(team.primary);
  const onSecondary = readableOn(team.secondary);
  const first = overview.days[0]?.datum ?? weekStart;
  const last = overview.days.at(-1)?.datum ?? weekStart;

  return (
    <div
      id={id}
      lang="nl"
      className="flex flex-col overflow-hidden bg-white text-slate-900"
      style={{ width: POSTER_WIDTH, height: POSTER_HEIGHT }}
    >
      <header className="flex items-center gap-5 px-7 py-4" style={{ backgroundColor: team.primary, color: onPrimary }}>
        {team.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" crossOrigin="anonymous" className="h-16 w-16 rounded-full bg-white object-contain p-1" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
            {team.clubName} · {team.teamName}
          </p>
          <h1 className="text-3xl font-extrabold tracking-wide uppercase">{p.title}</h1>
          <p className="text-sm opacity-90">{p.week(shortDate(first), shortDate(last))}</p>
        </div>
        {overview.keyMessage && (
          <div className="max-w-md rounded-xl px-4 py-2.5" style={{ backgroundColor: team.secondary, color: onSecondary }}>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-80">{p.keyMessage}</p>
            <p className="text-base leading-snug font-semibold">{overview.keyMessage}</p>
          </div>
        )}
      </header>

      <div
        className="grid flex-1 gap-px bg-slate-200 p-px"
        style={{
          // Rest days get a narrower column, so the training days have room.
          gridTemplateColumns: `112px ${overview.days.map((d) => (d.soort === "rust" ? "minmax(0, 0.6fr)" : "minmax(0, 1fr)")).join(" ")}`,
          gridTemplateRows: "min-content minmax(90px, 1fr) minmax(140px, 2fr) minmax(70px, 1fr) min-content min-content",
        }}
      >
        <Label />
        {overview.days.map((d) => (
          <DayHead key={d.datum} day={d} team={team} />
        ))}

        <Label>{p.rows.goal}</Label>
        {overview.days.map((d) => (
          <Cell key={d.datum} day={d}>
            <p className="text-[15px] leading-snug font-bold">{d.soort === "rust" ? p.rest : d.objective}</p>
          </Cell>
        ))}

        <Label>{p.rows.content}</Label>
        {overview.days.map((d) => (
          <Cell key={d.datum} day={d}>
            {d.soort === "wedstrijd" && d.match ? (
              <p className="text-[15px] leading-snug font-semibold">{p.opponent(d.match.opponent, d.match.home)}</p>
            ) : (
              <ul className="space-y-2">
                {d.content.map((c) => (
                  <li key={c} className="flex gap-2 text-[14px] leading-snug">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.primary }} />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </Cell>
        ))}

        <Label>{p.rows.focus}</Label>
        {overview.days.map((d) => (
          <Cell key={d.datum} day={d}>
            {d.focus && (
              <p className="text-[14px] leading-snug font-semibold" style={{ color: team.primary }}>
                {d.focus}
              </p>
            )}
          </Cell>
        ))}

        <Label>{p.rows.time}</Label>
        {overview.days.map((d) => (
          <Cell key={d.datum} day={d}>
            <p className="text-[14px] font-semibold tabular-nums">
              {[d.start, d.durationMin ? p.duration(d.durationMin) : null].filter(Boolean).join(" · ")}
            </p>
          </Cell>
        ))}

        <Label>{p.rows.intensity}</Label>
        {overview.days.map((d) => (
          <Cell key={d.datum} day={d}>
            <p className="mb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              {d.soort === "wedstrijd" ? p.match : d.load}
            </p>
            <div className="flex gap-1" aria-label={`${d.intensity}/${INTENSITY_MAX}`}>
              {Array.from({ length: INTENSITY_MAX }, (_, i) => (
                <span
                  key={i}
                  className="h-4 flex-1 rounded-sm"
                  style={{
                    backgroundColor: i < d.intensity ? (d.soort === "wedstrijd" ? team.secondary : team.primary) : "#e2e8f0",
                  }}
                />
              ))}
            </div>
          </Cell>
        ))}
      </div>
    </div>
  );
}

function Label({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center bg-slate-100 px-3 text-[11px] font-bold tracking-wider text-slate-600 uppercase">{children}</div>
  );
}

function DayHead({ day, team }: { day: OverviewDay; team: PosterTeam }) {
  const background = day.soort === "wedstrijd" ? team.secondary : day.soort === "rust" ? "#94a3b8" : team.primary;
  return (
    <div className="px-2 py-2.5 text-center" style={{ backgroundColor: background, color: readableOn(background) }}>
      <p className="text-xl leading-none font-extrabold">{day.md ?? "–"}</p>
      <p className="mt-1 text-[11px] font-semibold tracking-wider uppercase">{weekdayName(day.datum)}</p>
      <p className="text-[10px] opacity-80">{shortDate(day.datum)}</p>
    </div>
  );
}

function Cell({ day, children }: { day: OverviewDay; children: ReactNode }) {
  return (
    <div className={`min-w-0 px-2.5 py-2 break-words hyphens-auto ${day.soort === "rust" ? "bg-slate-50 text-slate-500" : "bg-white"}`}>
      {children}
    </div>
  );
}
