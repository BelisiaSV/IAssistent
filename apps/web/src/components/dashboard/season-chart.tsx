"use client";

import { useState } from "react";

import { messages } from "@/lib/messages";
import { OUTCOME_COLORS, type PlayedMatch } from "@/lib/teams/dashboard";
import { shortDate } from "@/lib/weeks/dates";

const m = messages.dashboard;


const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 34 };

/** Running points over the season: one line, a marker per match coloured by its result, hover for the match. */
export function SeasonChart({ matches, color }: { matches: PlayedMatch[]; color: string }) {
  const [active, setActive] = useState<number | null>(null);
  const maxPoints = Math.max(3, matches.length * 3);
  const step = maxPoints <= 12 ? 3 : maxPoints <= 30 ? 6 : 12;
  const top = Math.ceil(Math.max(3, ...matches.map((p) => p.points)) / step) * step;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (matches.length === 1 ? innerW / 2 : (innerW * i) / (matches.length - 1));
  const y = (points: number) => PAD.top + innerH - (innerH * points) / top;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const line = matches.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.points).toFixed(1)}`).join(" ");
  const area = `${line} L${x(matches.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const hit = matches.length > 1 ? innerW / (matches.length - 1) : innerW;
  const current = active !== null ? matches[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={m.season.title} onMouseLeave={() => setActive(null)}>
        <defs>
          <linearGradient id="season-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {t}
            </text>
          </g>
        ))}
        {matches.length > 1 && <path d={area} fill="url(#season-fill)" />}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="#94a3b8" strokeDasharray="3 3" />}
        {matches.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)}
            cy={y(p.points)}
            r={active === i ? 6.5 : 5}
            fill={OUTCOME_COLORS[p.outcome]}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
        {matches.map((p, i) => (
          <text key={`d-${p.date}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8" className={labelEvery(matches.length, i) ? "" : "hidden"}>
            {shortDate(p.date)}
          </text>
        ))}
        {matches.map((p, i) => (
          <rect
            key={`h-${p.date}`}
            x={x(i) - hit / 2}
            y={PAD.top}
            width={hit}
            height={innerH + 8}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            tabIndex={0}
            aria-label={`${shortDate(p.date)} ${p.opponent} ${p.goalsFor}-${p.goalsAgainst}`}
          />
        ))}
      </svg>
      {current && active !== null && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(current.points) / H) * 100}%`, marginTop: -12 }}
        >
          <p className="text-slate-300">{shortDate(current.date)}</p>
          <p className="font-semibold">{current.opponent}</p>
          <p className="mt-0.5 flex items-center gap-2 tabular-nums">
            <span className="rounded px-1 font-bold" style={{ backgroundColor: OUTCOME_COLORS[current.outcome] }}>
              {m.form.letter[current.outcome]}
            </span>
            {current.goalsFor}-{current.goalsAgainst} · {m.season.tooltip(current.points)}
          </p>
        </div>
      )}
    </div>
  );
}

/** Date labels: all when few matches, else roughly every fourth plus the last. */
function labelEvery(n: number, i: number) {
  if (n <= 8) return true;
  const every = Math.ceil(n / 6);
  return i % every === 0 || i === n - 1;
}
