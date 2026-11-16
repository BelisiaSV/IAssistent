import type { CSSProperties, ReactNode } from "react";

import { DrawingView } from "@/components/proposals/drawing";
import { messages } from "@/lib/messages";
import type { PresentationData, SlideLineup, SlidePlayer } from "@/lib/presentation/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

const m = messages.presentation;
const t = m.slides;

/** Design size of a slide (16:9, as the Canva template); the viewer scales it. */
export const SLIDE_W = 1440;
export const SLIDE_H = 810;

const RESULT_COLORS = { win: "#7ed957", draw: "#ff8a1f", loss: "#ff2d2d" } as const;
const PRINCIPLE = "#f6b3b3";

/** The display font, bold and slanted like the template. */
const display: CSSProperties = { fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 800, textTransform: "uppercase", lineHeight: 0.9 };

function Frame({ children, background }: { children: ReactNode; background: string }) {
  return (
    <div className="slide-light relative overflow-hidden text-white" style={{ width: SLIDE_W, height: SLIDE_H, background }}>
      {children}
    </div>
  );
}

function Logo({ url, label, size, className = "" }: { url: string | null; label: string; size: number; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label} crossOrigin="anonymous" className={`object-contain ${className}`} style={{ width: size, height: size }} />
  ) : (
    <div
      className={`flex items-center justify-center rounded bg-white/85 p-2 text-center text-slate-700 ${className}`}
      style={{ width: size, height: size, ...display, fontSize: Math.max(14, size / 8) }}
    >
      {label}
    </div>
  );
}

function Photo({ url, opacity = 1 }: { url: string | null; opacity?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover" style={{ opacity }} /> : null;
}

function Missing({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div className={`absolute inset-x-0 bottom-6 mx-auto w-fit rounded-lg px-4 py-2 text-lg ${dark ? "bg-slate-900/70 text-white" : "bg-white/90 text-slate-800"}`}>
      {text}
    </div>
  );
}

const lighten = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, white)`;
const darken = (color: string, pct: number) => `color-mix(in srgb, ${color} ${100 - pct}%, black)`;

/** Slide 1: matchday cover. */
export function CoverSlide({ data }: { data: PresentationData }) {
  const { team, match, opponent } = data;
  return (
    <Frame background={darken(team.primary, 35)}>
      <Photo url={team.coverUrl} opacity={0.55} />
      <div className="absolute inset-0" style={{ background: lighten(team.primary, 35), opacity: 0.55, clipPath: "polygon(0 0, 58% 0, 30% 100%, 0 100%)" }} />
      {team.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" crossOrigin="anonymous" className="absolute object-contain" style={{ right: 60, top: 70, width: 720, height: 720, opacity: 0.35 }} />
      )}
      <div className="absolute" style={{ left: 18, top: 10, ...display, fontSize: 250 }}>
        {t.matchday}
      </div>
      <div className="absolute flex items-baseline gap-5" style={{ left: 180, top: 270, ...display, fontSize: 64 }}>
        <span style={{ fontSize: 80, opacity: 0.85 }}>{t.vs}</span>
        <span>{opponent?.name ?? ""}</span>
      </div>
      <div className="absolute" style={{ left: 330, top: 390 }}>
        {opponent && <Logo url={opponent.logoUrl} label={opponent.name} size={250} />}
      </div>
      {match && (
        <div className="absolute" style={{ left: 80, bottom: 30, ...display, fontSize: 52 }}>
          {weekdayName(match.date)} {longDate(match.date)}
          {match.start && ` · ${match.start}`}
        </div>
      )}
    </Frame>
  );
}

/** Slide 2: the opponent in numbers. */
export function OpponentSlide({ data }: { data: PresentationData }) {
  const { team, opponent, stats } = data;
  const label = { color: lighten(team.primary, 55), ...display, fontSize: 40, fontStyle: "normal" as const, fontWeight: 600 };
  return (
    <Frame background={team.primary}>
      <div className="absolute" style={{ left: 85, top: 30 }}>
        <div style={label}>{t.opponent}</div>
        <div style={{ ...display, fontSize: 64 }}>{opponent?.name ?? ""}</div>
      </div>
      <div className="absolute" style={{ left: 110, top: 320 }}>
        {opponent && <Logo url={opponent.logoUrl} label={opponent.name} size={270} />}
      </div>
      {stats ? (
        <>
          <div className="absolute" style={{ left: 440, top: 340 }}>
            <div style={label}>{t.position}</div>
            <div style={{ ...display, fontSize: 130 }}>{stats.position ?? "–"}</div>
          </div>
          <div className="absolute" style={{ left: 620, top: 340 }}>
            <div style={label}>{t.record}</div>
            <div style={{ ...display, fontSize: 130 }}>
              {stats.record.win}-{stats.record.draw}-{stats.record.loss}
            </div>
            <div style={{ ...label, fontSize: 30, marginTop: 8 }}>{t.pointsFrom(stats.points, stats.matches)}</div>
          </div>
          <div className="absolute" style={{ left: 930, top: 340 }}>
            <div style={label}>{t.lastFive}</div>
            <div className="mt-1 flex gap-2">
              {stats.last.map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-4" style={{ width: 88 }}>
                  <span style={{ ...display, fontSize: 120, color: RESULT_COLORS[r.outcome] }}>{t.letters[r.outcome]}</span>
                  <Logo url={r.logoUrl} label={r.opponent} size={64} />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <Missing text={m.missing.stats} />
      )}
    </Frame>
  );
}

const PITCH = "#3f8c1c";

/** A pitch in perspective with name tags standing upright on it. */
function Pitch3D({ players, tag, width = 560, height = 640 }: { players: SlidePlayer[]; tag: { bg: string; text: string }; width?: number; height?: number }) {
  const line = "rgba(255,255,255,0.9)";
  return (
    <div style={{ perspective: 1300, perspectiveOrigin: "50% 20%", width: width + 200, height: height * 0.78 }} className="flex justify-center">
      <div
        className="relative"
        style={{
          width,
          height,
          transform: "rotateX(38deg)",
          transformOrigin: "50% 0%",
          transformStyle: "preserve-3d",
          background: `repeating-linear-gradient(0deg, ${PITCH} 0 40px, #4a9a22 40px 80px)`,
          border: `4px solid ${line}`,
          boxShadow: "0 30px 0 #2b6512",
        }}
      >
        <div className="absolute left-0 right-0" style={{ top: "50%", borderTop: `3px solid ${line}` }} />
        <div className="absolute rounded-full" style={{ left: "50%", top: "50%", width: 150, height: 150, marginLeft: -75, marginTop: -75, border: `3px solid ${line}` }} />
        <div className="absolute" style={{ left: "22%", right: "22%", top: 0, height: "16%", border: `3px solid ${line}`, borderTop: 0 }} />
        <div className="absolute" style={{ left: "22%", right: "22%", bottom: 0, height: "16%", border: `3px solid ${line}`, borderBottom: 0 }} />
        {players.map((p, i) => (
          <div
            key={i}
            className="absolute flex items-stretch"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%) rotateX(-38deg)", transformOrigin: "50% 100%", height: 34 }}
          >
            <span className="flex items-center justify-center bg-black px-2 text-white" style={{ ...display, fontStyle: "normal", fontSize: 22, transform: "skewX(-12deg)", minWidth: 34 }}>
              {p.number ?? ""}
            </span>
            <span
              className="flex items-center px-3 whitespace-nowrap"
              style={{ ...display, fontStyle: "normal", fontWeight: 700, fontSize: 20, background: tag.bg, color: tag.text, transform: "skewX(-12deg)", minWidth: 110 }}
            >
              {p.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineupHeading({ lineup, dark = false }: { lineup: SlideLineup | null; dark?: boolean }) {
  return (
    <div className="text-center" style={{ color: dark ? "#111" : "#fff" }}>
      <div style={{ ...display, fontSize: 72 }}>{t.startingXI}</div>
      {lineup && <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28 }}>({lineup.formation})</div>}
    </div>
  );
}

/** Slide 3: lineup of the opponent. */
export function OpponentLineupSlide({ data }: { data: PresentationData }) {
  const { team, opponent, opponentLineup } = data;
  return (
    <Frame background="linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 45%, #94a3b8 100%)">
      <div className="absolute inset-y-0 left-0" style={{ width: 230, background: team.primary }}>
        <div className="p-5" style={{ ...display, fontSize: 58 }}>
          {t.analysis.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">{opponent && <Logo url={opponent.logoUrl} label={opponent.name} size={200} />}</div>
      </div>
      <div className="absolute flex flex-col items-center" style={{ left: 330, right: 40, top: 30 }}>
        <LineupHeading lineup={opponentLineup} dark />
        {opponentLineup && <Pitch3D players={opponentLineup.players} tag={{ bg: "#ffffff", text: "#111" }} />}
      </div>
      {!opponentLineup && <Missing text={m.missing.opponentLineup} dark />}
    </Frame>
  );
}

function OwnHeader({ data }: { data: PresentationData }) {
  const { team } = data;
  return (
    <div className="absolute inset-x-0 top-0 flex items-center gap-4 px-4" style={{ height: 96, background: darken(team.primary, 10) }}>
      <Logo url={team.logoUrl} label={team.clubName} size={80} />
      <span style={{ ...display, fontSize: 34, fontStyle: "normal" }}>{team.clubName}</span>
    </div>
  );
}

/** Slides 4 and 5: own lineup, the second with the substitutes ("gamechangers"). */
export function OwnLineupSlide({ data, lineup, withBench }: { data: PresentationData; lineup: SlideLineup | null; withBench: boolean }) {
  const { team } = data;
  const light = lighten(team.primary, 45);
  return (
    <Frame background={lighten(team.primary, 30)}>
      <Photo url={team.photoUrl} opacity={0.35} />
      <OwnHeader data={data} />
      <div className="absolute flex flex-col items-center" style={{ left: 0, right: withBench ? 380 : 0, top: 8 }}>
        <LineupHeading lineup={lineup} />
        {lineup && (
          <div style={{ marginTop: 18 }}>
            <Pitch3D players={lineup.players} tag={{ bg: light, text: "#0f172a" }} width={520} height={600} />
          </div>
        )}
      </div>
      {withBench && lineup && (
        <div className="absolute" style={{ right: 120, top: 180 }}>
          <div style={{ ...display, fontSize: 48 }}>{t.gamechangers}</div>
          <ul className="mt-4 space-y-3">
            {lineup.bench.map((b, i) => (
              <li key={i} className="flex items-center gap-4" style={{ ...display, fontStyle: "normal", fontSize: 26 }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-white" style={{ fontSize: 22 }}>
                  {b.number ?? ""}
                </span>
                {b.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!lineup && <Missing text={m.missing.ownLineup} dark />}
    </Frame>
  );
}

/** Slide 6: the principle as title. */
export function PrincipleTitleSlide({ data }: { data: PresentationData }) {
  const { principle } = data;
  return (
    <Frame background="#ffffff">
      <div className="absolute inset-x-0 top-0 flex items-center" style={{ height: 96, background: PRINCIPLE }}>
        <div className="flex items-center gap-4 px-4">
          <Logo url={data.team.logoUrl} label={data.team.clubName} size={80} />
          <span style={{ ...display, fontSize: 34, fontStyle: "normal" }}>{data.team.clubName}</span>
        </div>
        <div className="absolute inset-x-0 text-center text-slate-900" style={{ ...display, fontSize: 72 }}>
          {principle?.title ?? ""}
        </div>
      </div>
      {principle?.explanation && (
        <p className="absolute text-center text-slate-800" style={{ left: 160, right: 160, top: 300, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 52, lineHeight: 1.15 }}>
          {principle.explanation}
        </p>
      )}
      {!principle && <Missing text={m.missing.principle} dark />}
    </Frame>
  );
}

/** Slide 7: the principle drawn on the pitch. */
export function PrincipleDrawingSlide({ data }: { data: PresentationData }) {
  const { team, principle } = data;
  return (
    <Frame background="linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 50%, #94a3b8 100%)">
      <div className="absolute inset-y-0 left-0" style={{ width: 220, background: team.primary }}>
        <div className="p-4" style={{ ...display, fontSize: 46 }}>
          {principle?.title ?? ""}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 260 }}>
          <Logo url={team.logoUrl} label={team.clubName} size={150} />
        </div>
      </div>
      <div className="absolute flex items-center justify-center rounded-lg p-2 text-slate-900" style={{ left: 260, top: 16, width: 560, height: 778, background: "#ffffff" }}>
        {principle?.drawing ? <DrawingView drawing={{ ...principle.drawing, uitleg: [] }} className="w-full [&_svg]:max-h-[740px]" /> : null}
      </div>
      {principle?.drawing?.uitleg?.length ? (
        <ul className="absolute space-y-4 text-slate-900" style={{ left: 870, right: 60, top: 120, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 36 }}>
          {principle.drawing.uitleg.map((u) => (
            <li key={u}>• {u}</li>
          ))}
        </ul>
      ) : null}
      {!principle?.drawing && <Missing text={m.missing.principle} dark />}
    </Frame>
  );
}

/** The seven slides of the template, in order. */
export function presentationSlides(data: PresentationData): { key: string; node: ReactNode }[] {
  const [first, second] = [data.ownLineups[0] ?? null, data.ownLineups[1] ?? data.ownLineups[0] ?? null];
  return [
    { key: "cover", node: <CoverSlide data={data} /> },
    { key: "opponent", node: <OpponentSlide data={data} /> },
    { key: "opponent-lineup", node: <OpponentLineupSlide data={data} /> },
    { key: "lineup", node: <OwnLineupSlide data={data} lineup={first} withBench={false} /> },
    { key: "lineup-bench", node: <OwnLineupSlide data={data} lineup={second} withBench /> },
    { key: "principle", node: <PrincipleTitleSlide data={data} /> },
    { key: "principle-drawing", node: <PrincipleDrawingSlide data={data} /> },
  ];
}
