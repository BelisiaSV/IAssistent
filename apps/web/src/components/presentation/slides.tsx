import type { CSSProperties, ReactNode } from "react";

import { DrawingView } from "@/components/proposals/drawing";
import { messages } from "@/lib/messages";
import {
  layoutLineup,
  PITCH_TOP,
  PITCH_UNIT,
} from "@/lib/presentation/lineup-layout";
import type { PresentationData, SlideLineup } from "@/lib/presentation/types";
import { longDate, weekdayName } from "@/lib/weeks/dates";

const m = messages.presentation;
const t = m.slides;

/** Design size of a slide (16:9, as the Canva template); the viewer scales it. */
export const SLIDE_W = 1440;
export const SLIDE_H = 810;

const RESULT_COLORS = {
  win: "#7ed957",
  draw: "#ff8a1f",
  loss: "#ff2d2d",
} as const;
const PRINCIPLE = "#f6b3b3";

/** The display font, bold and slanted like the template. */
const display: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontStyle: "italic",
  fontWeight: 800,
  textTransform: "uppercase",
  lineHeight: 0.9,
};

function Frame({
  children,
  background,
}: {
  children: ReactNode;
  background: string;
}) {
  return (
    <div
      className="slide-light relative overflow-hidden text-white"
      style={{ width: SLIDE_W, height: SLIDE_H, background }}
    >
      {children}
    </div>
  );
}

function Logo({
  url,
  label,
  size,
  className = "",
}: {
  url: string | null;
  label: string;
  size: number;
  className?: string;
}) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      crossOrigin="anonymous"
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={`flex items-center justify-center rounded bg-white/85 p-2 text-center text-slate-700 ${className}`}
      style={{
        width: size,
        height: size,
        ...display,
        fontSize: Math.max(14, size / 8),
      }}
    >
      {label}
    </div>
  );
}

function Missing({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div
      className={`absolute inset-x-0 bottom-6 mx-auto w-fit rounded-lg px-4 py-2 text-lg ${dark ? "bg-slate-900/70 text-white" : "bg-white/90 text-slate-800"}`}
    >
      {text}
    </div>
  );
}

const lighten = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${100 - pct}%, white)`;
const darken = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${100 - pct}%, black)`;

/** Slide 1: matchday cover. */
export function CoverSlide({ data }: { data: PresentationData }) {
  const { team, match, opponent } = data;
  return (
    <Frame background={darken(team.primary, 35)}>
      <div
        className="absolute inset-0"
        style={{
          background: lighten(team.primary, 35),
          opacity: 0.55,
          clipPath: "polygon(0 0, 58% 0, 30% 100%, 0 100%)",
        }}
      />
      {team.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logoUrl}
          alt=""
          crossOrigin="anonymous"
          className="absolute object-contain"
          style={{ right: 60, top: 70, width: 720, height: 720, opacity: 0.35 }}
        />
      )}
      <div
        className="absolute"
        style={{ left: 18, top: 10, ...display, fontSize: 250 }}
      >
        {t.matchday}
      </div>
      <div
        className="absolute flex items-baseline gap-5"
        style={{ left: 180, top: 270, ...display, fontSize: 64 }}
      >
        <span style={{ fontSize: 80, opacity: 0.85 }}>{t.vs}</span>
        <span>{opponent?.name ?? ""}</span>
      </div>
      <div className="absolute" style={{ left: 330, top: 390 }}>
        {opponent && (
          <Logo url={opponent.logoUrl} label={opponent.name} size={250} />
        )}
      </div>
      {match && (
        <div
          className="absolute"
          style={{ left: 80, bottom: 30, ...display, fontSize: 52 }}
        >
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
  const label = {
    color: lighten(team.primary, 55),
    ...display,
    fontSize: 40,
    fontStyle: "normal" as const,
    fontWeight: 600,
  };
  return (
    <Frame background={team.primary}>
      <div className="absolute" style={{ left: 85, top: 30 }}>
        <div style={label}>{t.opponent}</div>
        <div style={{ ...display, fontSize: 64 }}>{opponent?.name ?? ""}</div>
      </div>
      <div className="absolute" style={{ left: 110, top: 320 }}>
        {opponent && (
          <Logo url={opponent.logoUrl} label={opponent.name} size={270} />
        )}
      </div>
      {stats ? (
        <>
          <div className="absolute" style={{ left: 440, top: 340 }}>
            <div style={label}>{t.position}</div>
            <div style={{ ...display, fontSize: 130 }}>
              {stats.position ?? "–"}
            </div>
          </div>
          <div className="absolute" style={{ left: 620, top: 340 }}>
            <div style={label}>{t.record}</div>
            <div style={{ ...display, fontSize: 130 }}>
              {stats.record.win}-{stats.record.draw}-{stats.record.loss}
            </div>
            <div style={{ ...label, fontSize: 30, marginTop: 8 }}>
              {t.pointsFrom(stats.points, stats.matches)}
            </div>
          </div>
          <div className="absolute" style={{ left: 930, top: 340 }}>
            <div style={label}>{t.lastFive}</div>
            <div className="mt-1 flex gap-2">
              {stats.last.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-4"
                  style={{ width: 88 }}
                >
                  <span
                    style={{
                      ...display,
                      fontSize: 120,
                      color: RESULT_COLORS[r.outcome],
                    }}
                  >
                    {t.letters[r.outcome]}
                  </span>
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

/** Colours of the lineup slides (like the club's #LINEUP11 graphic). */
const STADIUM_BG = "#0b3540";
const STADIUM = ["#0e414d", "#114c5a", "#145867"];
const GRASS = ["#1d9a52", "#22a85b"] as const;
const LINE = "rgba(255,255,255,0.32)";

/** Screen position of a formation slot (x 0..100 left→right, y 0 = opponent goal, 100 = own goal). */
function project(width: number, x: number, y: number) {
  const sy = PITCH_TOP + y * PITCH_UNIT;
  const half = width * (0.34 + (0.16 * y) / 100);
  return { sx: width / 2 + ((x - 50) / 50) * half, sy, half };
}

function Shirt({
  body,
  trim,
  number,
}: {
  body: string;
  trim: string;
  number: number | null;
}) {
  return (
    <div className="relative" style={{ width: 84, height: 74 }}>
      <svg viewBox="0 0 100 88" width={84} height={74} aria-hidden>
        <path
          d="M36 4 L22 8 L4 24 L13 42 L24 36 L24 86 L76 86 L76 36 L87 42 L96 24 L78 8 L64 4 Q50 16 36 4 Z"
          fill={body}
          stroke={darken(body, 25)}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path d="M36 4 Q50 16 64 4 L60 2 Q50 11 40 2 Z" fill={trim} />
        <path
          d="M4 24 L13 42"
          stroke={trim}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path
          d="M96 24 L87 42"
          stroke={trim}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path
          d="M24 36 L24 86 L76 86 L76 36"
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={6}
        />
      </svg>
      <span
        className="absolute flex items-center justify-center rounded-full bg-white text-slate-900"
        style={{
          right: -14,
          bottom: -10,
          width: 42,
          height: 42,
          border: "3px solid #1e293b",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 22,
        }}
      >
        {number ?? ""}
      </span>
    </div>
  );
}

/**
 * A lineup in the style of the club's graphic: stadium, pitch in perspective
 * with the goal at the top, shirts with the number and the name below.
 */
function LineupPitch({
  lineup,
  title,
  kit,
  left = 0,
}: {
  lineup: SlideLineup | null;
  title: string;
  kit: { body: string; trim: string };
  left?: number;
}) {
  const width = SLIDE_W - left;
  const cx = width / 2;
  const at = (y: number) => project(width, 50, y);
  const box = (y0: number, y1: number, share: number) => {
    const a = at(y0);
    const b = at(y1);
    return `${cx - a.half * share},${a.sy} ${cx + a.half * share},${a.sy} ${cx + b.half * share},${b.sy} ${cx - b.half * share},${b.sy}`;
  };
  const edge = (y: number) => at(y);
  const bands = Array.from({ length: 12 }, (_, i) => i * 10);
  const keeper = { body: kit.trim, trim: kit.body };
  const layout = layoutLineup(lineup?.players.map((p) => p.y) ?? [], {
    withDetail: lineup?.players.some((p) => p.detail) ?? false,
  });
  return (
    <div
      className="absolute inset-y-0 overflow-hidden"
      style={{ left, width, background: STADIUM_BG }}
    >
      {STADIUM.map((c, i) => (
        <div
          key={c}
          className="absolute"
          style={{
            left: 60 + i * 70,
            right: 60 + i * 70,
            top: 14 + i * 40,
            bottom: 0,
            background: c,
            borderRadius: "320px 320px 0 0",
          }}
        />
      ))}
      <svg
        className="absolute inset-0"
        width={width}
        height={SLIDE_H}
        aria-hidden
      >
        {bands.map((y, i) => {
          const a = edge(y);
          const b = edge(y + 10);
          return (
            <polygon
              key={y}
              points={`${cx - a.half},${a.sy} ${cx + a.half},${a.sy} ${cx + b.half},${b.sy} ${cx - b.half},${b.sy}`}
              fill={GRASS[i % 2 === 0 ? 0 : 1]}
            />
          );
        })}
        <g fill="none" stroke={LINE} strokeWidth={3}>
          <polygon points={box(0, 120, 1)} />
          <line
            x1={cx - at(50).half}
            y1={at(50).sy}
            x2={cx + at(50).half}
            y2={at(50).sy}
          />
          <ellipse cx={cx} cy={at(50).sy} rx={width * 0.085} ry={46} />
          <polygon points={box(0, 16, 0.44)} />
          <polygon points={box(0, 6, 0.2)} />
          <polygon points={box(84, 100, 0.44)} />
          <polygon points={box(94, 100, 0.2)} />
        </g>
      </svg>
      {/* Goal at the top */}
      <div
        className="absolute"
        style={{
          left: cx - 105,
          top: at(0).sy - 50,
          width: 210,
          height: 50,
          border: "6px solid #e5e7eb",
          borderBottom: 0,
          borderRadius: "10px 10px 0 0",
          background:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 12px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 12px)",
        }}
      />
      <div
        className="absolute inset-x-0 text-center"
        style={{
          top: 36,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 64,
          lineHeight: 1,
          textShadow: "0 2px 8px rgba(0,0,0,0.35)",
        }}
      >
        {title}
      </div>
      {lineup?.players.map((p, i) => {
        const { sx, sy } = project(width, p.x, layout.ys[i] ?? p.y);
        const colors = p.goalkeeper ? keeper : kit;
        return (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{
              left: sx,
              top: sy - 52,
              transform: `translateX(-50%) scale(${layout.scale})`,
              transformOrigin: "50% 52px",
            }}
          >
            <Shirt body={colors.body} trim={colors.trim} number={p.number} />
            <span
              className="mt-2 whitespace-nowrap"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 1,
                textShadow: "0 2px 6px rgba(0,0,0,0.45)",
              }}
            >
              {p.name}
            </span>
            {p.detail && (
              <span
                className="mt-0.5 whitespace-nowrap"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: 21,
                  lineHeight: 1.1,
                  textShadow: "0 2px 6px rgba(0,0,0,0.45)",
                }}
              >
                {p.detail}
              </span>
            )}
          </div>
        );
      })}
      {lineup && (
        <div
          className="absolute"
          style={{
            right: 36,
            bottom: 22,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: 44,
            lineHeight: 1,
          }}
        >
          #{lineup.formation}
        </div>
      )}
    </div>
  );
}

/** Contrast colour for shirts that have no colours yet. */
const NEUTRAL_KIT = { body: "#e2e8f0", trim: "#475569" };

/** Slide 3: lineup of the opponent, next to the "opponent analysis" bar. */
export function OpponentLineupSlide({ data }: { data: PresentationData }) {
  const { team, opponent, opponentLineup } = data;
  const bar = 300;
  const kit = opponent?.shirt
    ? {
        body: opponent.shirt,
        trim: opponent.trim ?? darken(opponent.shirt, 40),
      }
    : NEUTRAL_KIT;
  return (
    <Frame background={STADIUM_BG}>
      <LineupPitch
        lineup={opponentLineup}
        title={opponent?.name ?? ""}
        kit={kit}
        left={bar}
      />
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: bar, background: team.primary }}
      >
        <div style={{ padding: "34px 26px", ...display, fontSize: 50 }}>
          {t.analysis.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="absolute" style={{ left: 22, bottom: 22 }}>
          {opponent && (
            <Logo
              url={opponent.logoUrl}
              label={opponent.name}
              size={bar - 44}
            />
          )}
        </div>
      </div>
      {!opponentLineup && <Missing text={m.missing.opponentLineup} />}
    </Frame>
  );
}

/** Slide 4: own lineup. */
export function OwnLineupSlide({ data }: { data: PresentationData }) {
  const { team, ownLineup } = data;
  return (
    <Frame background={STADIUM_BG}>
      <LineupPitch
        lineup={ownLineup}
        title={team.clubName}
        kit={{ body: team.primary, trim: team.secondary }}
      />
      {!ownLineup && <Missing text={m.missing.ownLineup} />}
    </Frame>
  );
}

function ClubMark({ data }: { data: PresentationData }) {
  return (
    <div className="flex shrink-0 items-center gap-4">
      <Logo url={data.team.logoUrl} label={data.team.clubName} size={80} />
      <span style={{ ...display, fontSize: 34, fontStyle: "normal" }}>
        {data.team.clubName}
      </span>
    </div>
  );
}

/** Slide 5: the principle as title, centred in the pink bar. */
export function PrincipleTitleSlide({ data }: { data: PresentationData }) {
  const { principle } = data;
  const title = principle?.title ?? "";
  const size = title.length > 40 ? 40 : title.length > 26 ? 52 : 68;
  return (
    <Frame background="#ffffff">
      <div
        className="absolute inset-x-0 top-0 flex items-center gap-6 px-4"
        style={{ minHeight: 120, background: PRINCIPLE }}
      >
        <ClubMark data={data} />
        <div
          className="min-w-0 flex-1 py-3 text-center text-slate-900"
          style={{ ...display, fontSize: size, lineHeight: 1 }}
        >
          {title}
        </div>
        {/* Same width as the club on the left, so the title sits in the middle of the bar. */}
        <div className="invisible" aria-hidden>
          <ClubMark data={data} />
        </div>
      </div>
      {principle?.explanation && (
        <p
          className="absolute text-center text-slate-800"
          style={{
            left: 160,
            right: 160,
            top: 300,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 52,
            lineHeight: 1.15,
          }}
        >
          {principle.explanation}
        </p>
      )}
      {!principle && <Missing text={m.missing.principle} dark />}
    </Frame>
  );
}

/** Slide 6: the principle drawn on the pitch. */
export function PrincipleDrawingSlide({ data }: { data: PresentationData }) {
  const { team, principle } = data;
  const bar = 240;
  return (
    <Frame background="linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 50%, #94a3b8 100%)">
      <div
        className="absolute inset-y-0 left-0 flex flex-col justify-between"
        style={{ width: bar, background: team.primary, padding: "24px 20px" }}
      >
        <div
          style={{
            ...display,
            fontSize: 40,
            lineHeight: 0.95,
            overflowWrap: "anywhere",
          }}
        >
          {principle?.title ?? ""}
        </div>
        <div className="flex justify-center">
          <Logo url={team.logoUrl} label={team.clubName} size={150} />
        </div>
      </div>
      <div
        className="absolute flex items-center justify-center rounded-lg p-2 text-slate-900"
        style={{
          left: bar + 40,
          top: 16,
          width: 560,
          height: 778,
          background: "#ffffff",
        }}
      >
        {principle?.drawing ? (
          <DrawingView
            drawing={{ ...principle.drawing, uitleg: [] }}
            className="w-full [&_svg]:max-h-[740px]"
          />
        ) : null}
      </div>
      {principle?.drawing?.uitleg?.length ? (
        <ul
          className="absolute space-y-4 text-slate-900"
          style={{
            left: bar + 640,
            right: 60,
            top: 120,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 36,
          }}
        >
          {principle.drawing.uitleg.map((u) => (
            <li key={u}>• {u}</li>
          ))}
        </ul>
      ) : null}
      {!principle?.drawing && <Missing text={m.missing.principle} dark />}
    </Frame>
  );
}

/** The slides of the template, in order. */
export function presentationSlides(
  data: PresentationData,
): { key: string; node: ReactNode }[] {
  return [
    { key: "cover", node: <CoverSlide data={data} /> },
    { key: "opponent", node: <OpponentSlide data={data} /> },
    { key: "opponent-lineup", node: <OpponentLineupSlide data={data} /> },
    { key: "lineup", node: <OwnLineupSlide data={data} /> },
    { key: "principle", node: <PrincipleTitleSlide data={data} /> },
    { key: "principle-drawing", node: <PrincipleDrawingSlide data={data} /> },
  ];
}
