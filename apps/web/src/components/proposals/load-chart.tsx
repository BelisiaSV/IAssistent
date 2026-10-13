"use client";

import { useState } from "react";

import { messages } from "@/lib/messages";

const m = messages.weeks.load;

export interface LoadChartDay {
  date: string;
  label: string;
  planned: number | null;
  actual: number | null;
}

// Categorical slots 1 and 2 of the reference palette (validated: CVD ΔE 24.7, contrast ≥ 3:1).
const PLANNED = "#2a78d6";
const ACTUAL = "#eb6834";

/** Planned vs. actual AU per day, as grouped bars on one axis. */
export function LoadChart({ days }: { days: LoadChartDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(100, ...days.flatMap((d) => [d.planned ?? 0, d.actual ?? 0]));
  const niceMax = Math.ceil(max / 200) * 200;
  const width = 640;
  const height = 200;
  const pad = { top: 12, right: 8, bottom: 28, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const band = plotW / days.length;
  const barW = Math.min(18, band / 3);
  const y = (v: number) => pad.top + plotH - (v / niceMax) * plotH;
  const ticks = [0, niceMax / 2, niceMax];

  const bar = (x: number, value: number | null, color: string) => {
    if (!value) return null;
    const top = y(value);
    const h = pad.top + plotH - top;
    const r = Math.min(4, h, barW / 2);
    // Rounded data end (top), square at the baseline.
    const d = `M${x},${pad.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + plotH} Z`;
    return <path d={d} fill={color} />;
  };

  const active = hover !== null ? days[hover] : null;

  return (
    <figure className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 print:hidden">
      <figcaption className="mb-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold">{m.chartTitle}</span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PLANNED }} /> {m.planned}
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ACTUAL }} /> {m.actual}
        </span>
        {active && (
          <span className="ml-auto text-slate-700 tabular-nums">
            {active.label}: {m.planned.toLowerCase()} {active.planned ?? "–"} · {m.actual.toLowerCase()} {active.actual ?? "–"} {m.au}
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={m.chartTitle}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#52514e">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + band * i} y={pad.top} width={band} height={plotH} fill={hover === i ? "#f1f5f9" : "transparent"} />
              {bar(cx - barW - 1, d.planned, PLANNED)}
              {bar(cx + 1, d.actual, ACTUAL)}
              <text x={cx} y={height - 10} textAnchor="middle" fontSize={11} fill="#52514e">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
