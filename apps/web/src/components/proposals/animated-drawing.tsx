"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { arc, type Projection, projection, quad } from "@/lib/animation/projection";
import { type AnimationTheme, DEFAULT_THEME, type TeamKey } from "@/lib/animation/theme";

/** Keyframe: [seconds, x %, y %] (x 0 = left, y 0 = top = goal we attack). */
type Key = [number, number, number];
type Point = [number, number];

export interface Animation {
  titel: string;
  duur_s: number;
  veld: { type: "volledig" | "half" | "zone"; breedte_m: number; lengte_m: number };
  /** Part of the field to show, in % of the field (zoom). */
  uitsnede?: { x: number; y: number; breedte: number; hoogte: number };
  raster?: { x_m: number[]; y_m: number[] };
  vast: Overlay[];
  overlays: Overlay[];
  spelers: {
    id: string;
    team: TeamKey;
    /** Own colour from the source; otherwise the team colour of the theme. */
    kleur?: string;
    label: string | null;
    soort: "speler" | "doelman";
    pad: Key[];
  }[];
  bal: Key[];
}

type Timed = { van?: number; tot?: number };
type Overlay = Timed &
  (
    | { soort: "zone"; stijl: "licht" | "gearceerd"; x: number; y: number; breedte: number; hoogte: number; label?: string }
    | { soort: "vlak"; stijl: "licht" | "gearceerd" | "omlijnd"; punten: Point[]; label?: string }
    | { soort: "tekst"; x: number; y: number; tekst: string }
    | { soort: "pijl"; pijl: "pass" | "loop" | "dribbel" | "schot"; van_x: number; van_y: number; naar_x: number; naar_y: number; buiging?: number; label?: string | null }
    | { soort: "doel" | "minidoel" | "ballen" | "kegel"; x: number; y: number }
  );


const SPEEDS = [0.5, 1, 2];
type M = [number, number];

function position(pad: Key[], t: number): Point {
  if (t <= pad[0]![0]) return [pad[0]![1], pad[0]![2]];
  for (let i = 1; i < pad.length; i++) {
    const [t1, x1, y1] = pad[i]!;
    if (t <= t1) {
      const [t0, x0, y0] = pad[i - 1]!;
      const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
  }
  const last = pad[pad.length - 1]!;
  return [last[1], last[2]];
}

/** Hex colour → shaded variant (amount < 0 darker, > 0 lighter). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function isLight(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}

interface Ctx {
  /** % of the field → metres. */
  m: (x: number, y: number) => M;
  /** Metres → drawing coordinates (with perspective). */
  pr: Projection;
  path: (pts: M[], close?: boolean) => string;
  u: number;
  W: number;
  uid: string;
  theme: AnimationTheme;
}

/**
 * Animated exercise: glossy 3D tokens, the ball, areas, arrows and labels over
 * time on a (optionally tilted) chequered pitch. Colours come from the theme.
 */
export function AnimatedDrawing({
  animation,
  theme = DEFAULT_THEME,
  logoUrl,
  autoPlay = false,
  labels,
}: {
  animation: Animation;
  theme?: AnimationTheme;
  logoUrl?: string | null;
  autoPlay?: boolean;
  labels: { play: string; pause: string; restart: string; speed: string };
}) {
  const uid = useId().replace(/:/g, "");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= animation.duur_s) {
          setPlaying(false);
          return animation.duur_s;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [playing, speed, animation.duur_s]);

  const W = animation.veld.breedte_m;
  const L = animation.veld.lengte_m;
  const pr = useMemo(() => projection(W, L, theme.kanteling), [W, L, theme.kanteling]);
  const m = (x: number, y: number): M => [(x / 100) * W, (y / 100) * L];
  const path = (pts: M[], close = false) =>
    pts.map((q, i) => {
      const r = pr.p(q[0], q[1]);
      return `${i ? "L" : "M"} ${r.x.toFixed(3)} ${r.y.toFixed(3)}`;
    }).join(" ") + (close ? " Z" : "");

  // Visible part (zoom) in drawing coordinates.
  const area = animation.uitsnede
    ? { x0: m(animation.uitsnede.x, 0)[0], y0: m(0, animation.uitsnede.y)[1], x1: m(animation.uitsnede.x + animation.uitsnede.breedte, 0)[0], y1: m(0, animation.uitsnede.y + animation.uitsnede.hoogte)[1] }
    : { x0: -3, y0: -3, x1: W + 3, y1: L + 3 };
  const corners = [pr.p(area.x0, area.y0), pr.p(area.x1, area.y0), pr.p(area.x0, area.y1), pr.p(area.x1, area.y1)];
  const vb = {
    x: Math.min(...corners.map((c) => c.x)),
    y: Math.min(...corners.map((c) => c.y)),
    w: Math.max(...corners.map((c) => c.x)) - Math.min(...corners.map((c) => c.x)),
    h: Math.max(...corners.map((c) => c.y)) - Math.min(...corners.map((c) => c.y)),
  };
  const u = Math.max(vb.w, vb.h) / 42;
  const ctx: Ctx = { m, pr, path, u, W, uid, theme };

  const visible = (o: Timed) => (o.van ?? 0) <= t && t < (o.tot ?? Infinity);
  const tokens = animation.spelers
    .map((p) => {
      const q = m(...position(p.pad, t));
      const color = p.kleur ?? (p.soort === "doelman" ? theme.doelman[p.team] : undefined) ?? theme.teams[p.team];
      return { id: p.id, q, color, label: p.label };
    })
    // Far tokens first, so near ones overlap them.
    .sort((a, b) => a.q[1] - b.q[1]);
  const ballM = m(...position(animation.bal, t));

  // Chequered grass in 5 m squares, projected.
  const squares = useMemo(() => {
    const out: string[] = [];
    for (let x = -10; x < W + 10; x += 5) {
      for (let y = -10; y < L + 10; y += 5) {
        if ((Math.round(x / 5) + Math.round(y / 5)) % 2 === 0) continue;
        out.push(path([[x, y], [x + 5, y], [x + 5, y + 5], [x, y + 5]], true));
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pr, W, L]);

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10" style={{ background: theme.rand }}>
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="mx-auto block max-h-[80vh] w-full" role="img" aria-label={animation.titel}>
          <defs>
            <pattern id={`hatch-${uid}`} width={u * 0.9} height={u * 0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <rect width={u * 0.9} height={u * 0.9} fill="#ffffff" fillOpacity={0.08} />
              <line x1={0} y1={0} x2={0} y2={u * 0.9} stroke="#ffffff" strokeWidth={u * 0.2} strokeOpacity={0.35} />
            </pattern>
            <pattern id={`net-${uid}`} width={u * 0.28} height={u * 0.28} patternUnits="userSpaceOnUse">
              <path d={`M 0 0 L ${u * 0.28} ${u * 0.28} M ${u * 0.28} 0 L 0 ${u * 0.28}`} stroke="#d4d4d8" strokeOpacity={0.75} strokeWidth={u * 0.03} />
            </pattern>
            <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="240%">
              <feDropShadow dx={u * 0.05} dy={u * 0.3} stdDeviation={u * 0.22} floodColor="#000" floodOpacity={0.6} />
            </filter>
            <linearGradient id={`metal-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.85 * theme.glans} />
              <stop offset="35%" stopColor="#ffffff" stopOpacity={0.1 * theme.glans} />
              <stop offset="55%" stopColor="#000000" stopOpacity={0.12 * theme.glans} />
              <stop offset="75%" stopColor="#ffffff" stopOpacity={0.35 * theme.glans} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0.3 * theme.glans} />
            </linearGradient>
            <radialGradient id={`vignette-${uid}`} cx="50%" cy="48%" r="70%">
              <stop offset="55%" stopColor="#000000" stopOpacity={0} />
              <stop offset="100%" stopColor="#000000" stopOpacity={theme.vignet} />
            </radialGradient>
          </defs>

          <rect x={vb.x - 5} y={vb.y - 5} width={vb.w + 10} height={vb.h + 10} fill={theme.gras[0]} />
          <path d={squares.join(" ")} fill={theme.gras[1]} />

          {animation.raster && (
            <g stroke={theme.lijnen} strokeOpacity={0.16} strokeWidth={u * 0.06} fill="none">
              {animation.raster.x_m.map((x) => <path key={`x${x}`} d={path([[x, 0], [x, L]])} />)}
              {animation.raster.y_m.map((y) => <path key={`y${y}`} d={path([[0, y], [W, y]])} />)}
            </g>
          )}

          <PitchLines L={L} ctx={ctx} />

          {[...animation.vast, ...animation.overlays].filter(visible).map((o, i) => (
            <OverlayView key={i} overlay={o} ctx={ctx} />
          ))}

          {tokens.map((tk) => (
            <Token key={tk.id} at={pr.p(...tk.q)} s={pr.scale(...tk.q)} color={tk.color} label={tk.label} ctx={ctx} />
          ))}

          <Ball at={pr.p(...ballM)} r={u * 0.55 * pr.scale(...ballM)} uid={uid} />

          {theme.vignet > 0 && <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#vignette-${uid})`} pointerEvents="none" />}
        </svg>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="pointer-events-none absolute top-3 right-3 h-14 w-14 object-contain drop-shadow" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            if (t >= animation.duur_s) setT(0);
            setPlaying(!playing);
          }}
          className="rounded-md bg-brand px-3 py-1.5 font-medium text-white"
        >
          {playing ? labels.pause : labels.play}
        </button>
        <button type="button" onClick={() => setT(0)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
          {labels.restart}
        </button>
        <input
          type="range"
          min={0}
          max={animation.duur_s}
          step={0.05}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="min-w-40 flex-1 accent-[var(--color-brand)]"
          aria-label="tijd"
        />
        <span className="w-20 text-right text-slate-600 tabular-nums">
          {t.toFixed(1)} / {animation.duur_s.toFixed(0)} s
        </span>
        <label className="flex items-center gap-1 text-slate-600">
          {labels.speed}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-md border border-slate-300 bg-white px-1 py-1">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </figure>
  );
}

/** A player as an upright glossy token with thickness; smaller further away. */
function Token({ at, s, color, label, ctx }: { at: { x: number; y: number }; s: number; color: string; label: string | null; ctx: Ctx }) {
  const { u, uid } = ctx;
  const r = u * 1.05 * s;
  const depth = r * 0.28;
  return (
    <g filter={`url(#shadow-${uid})`}>
      <ellipse cx={at.x} cy={at.y + depth} rx={r} ry={r * 0.92} fill={shade(color, -0.45)} />
      <rect x={at.x - r} y={at.y} width={r * 2} height={depth} fill={shade(color, -0.45)} />
      <ellipse cx={at.x} cy={at.y} rx={r} ry={r * 0.92} fill={color} />
      <ellipse cx={at.x} cy={at.y} rx={r} ry={r * 0.92} fill={`url(#metal-${uid})`} />
      <ellipse cx={at.x} cy={at.y} rx={r * 0.78} ry={r * 0.7} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={r * 0.06} />
      <ellipse cx={at.x - r * 0.25} cy={at.y - r * 0.38} rx={r * 0.45} ry={r * 0.2} fill="#ffffff" fillOpacity={0.45} />
      {label && (
        <text
          x={at.x}
          y={at.y + r * 0.04}
          fontSize={r * (label.length > 2 ? 0.7 : 0.9)}
          fontWeight={800}
          fill={isLight(color) ? "#18181b" : "#ffffff"}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function PitchLines({ L, ctx }: { L: number; ctx: Ctx }) {
  const { W, u, theme, path } = ctx;
  const s = { fill: "none", stroke: theme.lijnen, strokeWidth: u * theme.lijnDikte * 1.4, strokeOpacity: 0.9, strokeLinejoin: "round" as const };
  const rect = (x: number, y: number, w: number, h: number) => path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
  const spot = (x: number, y: number) => {
    const q = ctx.pr.p(x, y);
    return <circle cx={q.x} cy={q.y} r={u * 0.16 * ctx.pr.scale(x, y)} fill={theme.lijnen} />;
  };
  const box = (y: number, down: boolean) => {
    const d = down ? 1 : -1;
    const top = down ? y : y - 16.5;
    const ang = Math.asin(5.5 / 9.15);
    return (
      <g>
        <path d={rect((W - 40.32) / 2, top, 40.32, 16.5)} {...s} />
        <path d={rect((W - 18.32) / 2, down ? y : y - 5.5, 18.32, 5.5)} {...s} />
        <path d={path(down ? arc(W / 2, y + 11, 9.15, ang, Math.PI - ang) : arc(W / 2, y - 11, 9.15, -Math.PI + ang, -ang))} {...s} />
        {spot(W / 2, y + d * 11)}
      </g>
    );
  };
  return (
    <g>
      <path d={rect(0, 0, W, L)} {...s} />
      <path d={path([[0, L / 2], [W, L / 2]])} {...s} />
      <path d={path(arc(W / 2, L / 2, 9.15), true)} {...s} />
      {spot(W / 2, L / 2)}
      {box(0, true)}
      {box(L, false)}
    </g>
  );
}

function OverlayView({ overlay: o, ctx }: { overlay: Overlay; ctx: Ctx }) {
  const { m, pr, path, u, W, uid, theme } = ctx;
  switch (o.soort) {
    case "zone":
    case "vlak": {
      const pts: M[] =
        o.soort === "zone"
          ? [m(o.x, o.y), m(o.x + o.breedte, o.y), m(o.x + o.breedte, o.y + o.hoogte), m(o.x, o.y + o.hoogte)]
          : o.punten.map((p) => m(p[0], p[1]));
      const proj = pts.map((q) => pr.p(q[0], q[1]));
      const minX = Math.min(...proj.map((p) => p.x));
      const maxY = Math.max(...proj.map((p) => p.y));
      return (
        <g>
          <path
            d={path(pts, true)}
            fill={o.stijl === "gearceerd" ? `url(#hatch-${uid})` : "#ffffff"}
            fillOpacity={o.stijl === "licht" ? 0.18 : o.stijl === "omlijnd" ? 0.06 : 1}
            stroke={theme.accent}
            strokeWidth={u * 0.13}
            strokeOpacity={o.stijl === "gearceerd" ? 0.45 : 0.85}
            strokeDasharray={o.stijl === "omlijnd" ? `${u * 0.6} ${u * 0.4}` : undefined}
            strokeLinejoin="round"
          />
          {o.label && <Label x={minX + u * 0.6} y={maxY - u * 0.9} text={o.label} u={u} anchor="start" W={W} />}
        </g>
      );
    }
    case "tekst": {
      const p = pr.p(...m(o.x, o.y));
      return <Label x={p.x} y={p.y} text={o.tekst} u={u} anchor="middle" W={W} />;
    }
    case "pijl": {
      const a = m(o.van_x, o.van_y);
      const b = m(o.naar_x, o.naar_y);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const bend = (o.buiging ?? 0) * len;
      const c: M = [(a[0] + b[0]) / 2 - (dy / len) * bend, (a[1] + b[1]) / 2 + (dx / len) * bend];
      // Stop before the receiver; the head follows the end of the curve on screen.
      const pts = quad(a, c, b);
      const stop = 1.4 / len;
      const cut = pts.slice(0, Math.max(2, Math.round(pts.length * (1 - stop))));
      const end = pr.p(...cut[cut.length - 1]!);
      const prev = pr.p(...cut[cut.length - 2]!);
      const el = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
      const ux = (end.x - prev.x) / el;
      const uy = (end.y - prev.y) / el;
      const h = u * 0.85 * pr.scale(...b);
      return (
        <g filter={`url(#shadow-${uid})`}>
          <path d={path(cut)} fill="none" stroke={theme.accent} strokeWidth={u * 0.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={o.pijl === "loop" ? `${u * 0.6} ${u * 0.45}` : undefined} />
          <polygon
            points={`${end.x + ux * h * 0.5},${end.y + uy * h * 0.5} ${end.x - ux * h - uy * h * 0.55},${end.y - uy * h + ux * h * 0.55} ${end.x - ux * h + uy * h * 0.55},${end.y - uy * h - ux * h * 0.55}`}
            fill={theme.accent}
          />
        </g>
      );
    }
    case "doel":
    case "minidoel": {
      const [cx, cy] = m(o.x, o.y);
      const w = o.soort === "doel" ? 7.32 : 2.5;
      const d = o.soort === "doel" ? 2 : 1.2;
      const frame = path([[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]], true);
      return (
        <g filter={`url(#shadow-${uid})`}>
          <path d={frame} fill="#0a0a0a" fillOpacity={0.35} />
          <path d={frame} fill={`url(#net-${uid})`} stroke="#fafafa" strokeWidth={u * 0.14} strokeLinejoin="round" />
        </g>
      );
    }
    case "ballen": {
      const [cx, cy] = m(o.x, o.y);
      const s = pr.scale(cx, cy);
      return (
        <g>
          {[-1, 0, 1].map((i) => (
            <Ball key={i} at={pr.p(cx + i * 0.9, cy + i * 0.6)} r={u * 0.5 * s} uid={uid} />
          ))}
        </g>
      );
    }
    case "kegel": {
      const q = m(o.x, o.y);
      const p = pr.p(...q);
      const k = u * pr.scale(...q);
      return <polygon points={`${p.x},${p.y - k * 0.6} ${p.x - k * 0.5},${p.y + k * 0.4} ${p.x + k * 0.5},${p.y + k * 0.4}`} fill="#f59e0b" stroke="#b45309" strokeWidth={k * 0.08} />;
    }
  }
}

function Label({ x, y, text, u, anchor, W }: { x: number; y: number; text: string; u: number; anchor: "start" | "middle"; W: number }) {
  // Keep the label on the pitch: estimate its width and shift it inside.
  const size = u * 0.95;
  const width = text.length * size * 0.55;
  const left = anchor === "middle" ? x - width / 2 : x;
  const shift = Math.min(0, W - u * 0.4 - (left + width)) + Math.max(0, u * 0.4 - left);
  return (
    <text
      x={x + shift}
      y={y}
      fontSize={size}
      fontWeight={800}
      fill="#ffffff"
      textAnchor={anchor}
      dominantBaseline="central"
      style={{ fontFamily: "Oswald, 'Arial Narrow', Impact, sans-serif", letterSpacing: "0.02em" }}
      paintOrder="stroke"
      stroke="#000000"
      strokeOpacity={0.45}
      strokeWidth={u * 0.25}
    >
      {text}
    </text>
  );
}

function Ball({ at, r, uid }: { at: { x: number; y: number }; r: number; uid: string }) {
  const { x, y } = at;
  return (
    <g filter={`url(#shadow-${uid})`}>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke="#111827" strokeWidth={r * 0.18} />
      <polygon
        points={Array.from({ length: 5 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          return `${x + Math.cos(a) * r * 0.42},${y + Math.sin(a) * r * 0.42}`;
        }).join(" ")}
        fill="#111827"
      />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return <circle key={i} cx={x + Math.cos(a) * r * 0.86} cy={y + Math.sin(a) * r * 0.86} r={r * 0.17} fill="#111827" />;
      })}
    </g>
  );
}
