"use client";

import { useEffect, useId, useRef, useState } from "react";

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

/**
 * Animated exercise: players as 3D tokens, the ball, areas, arrows and labels
 * over time on a chequered pitch. Colours come from the theme (club colours).
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
  const at = (x: number, y: number) => ({ x: (x / 100) * W, y: (y / 100) * L });
  const crop = animation.uitsnede
    ? { ...at(animation.uitsnede.x, animation.uitsnede.y), w: (animation.uitsnede.breedte / 100) * W, h: (animation.uitsnede.hoogte / 100) * L }
    : { x: -2, y: -2, w: W + 4, h: L + 4 };
  // Sizes follow the visible part, so a zoomed-in exercise gets bigger tokens.
  const u = Math.max(crop.w, crop.h) / 42;
  const visible = (o: Timed) => (o.van ?? 0) <= t && t < (o.tot ?? Infinity);
  const ball = at(...position(animation.bal, t));
  const ctx = { at, u, W, uid, theme };

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-xl shadow-sm ring-1 ring-black/10" style={{ background: theme.gras[0] }}>
        <svg viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} className="mx-auto block max-h-[80vh] w-full" role="img" aria-label={animation.titel}>
          <defs>
            <pattern id={`grass-${uid}`} width={10} height={10} patternUnits="userSpaceOnUse">
              <rect width={10} height={10} fill={theme.gras[0]} />
              <rect width={5} height={5} fill={theme.gras[1]} />
              <rect x={5} y={5} width={5} height={5} fill={theme.gras[1]} />
            </pattern>
            <pattern id={`hatch-${uid}`} width={u * 0.9} height={u * 0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <rect width={u * 0.9} height={u * 0.9} fill="#ffffff" fillOpacity={0.12} />
              <line x1={0} y1={0} x2={0} y2={u * 0.9} stroke="#ffffff" strokeWidth={u * 0.22} strokeOpacity={0.45} />
            </pattern>
            <pattern id={`net-${uid}`} width={u * 0.3} height={u * 0.3} patternUnits="userSpaceOnUse">
              <path d={`M 0 0 L ${u * 0.3} ${u * 0.3} M ${u * 0.3} 0 L 0 ${u * 0.3}`} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={u * 0.035} />
            </pattern>
            <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx={u * 0.12} dy={u * 0.22} stdDeviation={u * 0.18} floodColor="#000" floodOpacity={0.35} />
            </filter>
            <radialGradient id={`shine-${uid}`} cx="35%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.55} />
              <stop offset="45%" stopColor="#ffffff" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#000000" stopOpacity={0.12} />
            </radialGradient>
          </defs>

          <rect x={crop.x - 10} y={crop.y - 10} width={crop.w + 20} height={crop.h + 20} fill={`url(#grass-${uid})`} />

          {animation.raster && (
            <g stroke={theme.lijnen} strokeOpacity={0.22} strokeWidth={u * 0.07}>
              {animation.raster.x_m.map((x) => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={L} />)}
              {animation.raster.y_m.map((y) => <line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />)}
            </g>
          )}

          <PitchLines W={W} L={L} u={u} color={theme.lijnen} />

          {[...animation.vast, ...animation.overlays].filter(visible).map((o, i) => (
            <OverlayView key={i} overlay={o} {...ctx} />
          ))}

          {animation.spelers.map((p) => {
            const q = at(...position(p.pad, t));
            const color = p.kleur ?? (p.soort === "doelman" ? theme.doelman[p.team] : undefined) ?? theme.teams[p.team];
            return <Token key={p.id} x={q.x} y={q.y} color={color} label={p.label} u={u} uid={uid} />;
          })}

          <Ball x={ball.x} y={ball.y} r={u * 0.55} uid={uid} />
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

/** A player as a round token with some thickness, a soft shadow and a light shine. */
function Token({ x, y, color, label, u, uid }: { x: number; y: number; color: string; label: string | null; u: number; uid: string }) {
  const r = u * 1.05;
  const depth = u * 0.22;
  return (
    <g filter={`url(#shadow-${uid})`}>
      <circle cx={x} cy={y + depth} r={r} fill={shade(color, -0.35)} />
      <circle cx={x} cy={y} r={r} fill={color} stroke={shade(color, -0.2)} strokeWidth={u * 0.06} />
      <circle cx={x} cy={y} r={r} fill={`url(#shine-${uid})`} />
      {label && (
        <text
          x={x}
          y={y}
          fontSize={u * (label.length > 2 ? 0.75 : 0.95)}
          fontWeight={800}
          fill={isLight(color) ? "#1f2937" : "#ffffff"}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function PitchLines({ W, L, u, color }: { W: number; L: number; u: number; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: u * 0.17, strokeOpacity: 0.95 };
  const box = (y: number, down: boolean) => {
    const d = down ? 1 : -1;
    return (
      <g>
        <rect x={(W - 40.32) / 2} y={down ? y : y - 16.5} width={40.32} height={16.5} {...s} />
        <rect x={(W - 18.32) / 2} y={down ? y : y - 5.5} width={18.32} height={5.5} {...s} />
        <circle cx={W / 2} cy={y + d * 11} r={u * 0.18} fill={color} />
        <path d={`M ${W / 2 - 7.3} ${y + d * 16.5} A 9.15 9.15 0 0 ${down ? 0 : 1} ${W / 2 + 7.3} ${y + d * 16.5}`} {...s} />
      </g>
    );
  };
  return (
    <g>
      <rect x={0} y={0} width={W} height={L} {...s} />
      <line x1={0} y1={L / 2} x2={W} y2={L / 2} {...s} />
      <circle cx={W / 2} cy={L / 2} r={9.15} {...s} />
      <circle cx={W / 2} cy={L / 2} r={u * 0.18} fill={color} />
      {box(0, true)}
      {box(L, false)}
    </g>
  );
}

function OverlayView({
  overlay: o,
  at,
  u,
  W,
  uid,
  theme,
}: {
  overlay: Overlay;
  at: (x: number, y: number) => { x: number; y: number };
  u: number;
  W: number;
  uid: string;
  theme: AnimationTheme;
}) {
  switch (o.soort) {
    case "zone":
    case "vlak": {
      const pts =
        o.soort === "zone"
          ? [at(o.x, o.y), at(o.x + o.breedte, o.y), at(o.x + o.breedte, o.y + o.hoogte), at(o.x, o.y + o.hoogte)]
          : o.punten.map((p) => at(p[0], p[1]));
      const d = pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") + " Z";
      const minX = Math.min(...pts.map((p) => p.x));
      const maxY = Math.max(...pts.map((p) => p.y));
      return (
        <g>
          <path
            d={d}
            fill={o.stijl === "gearceerd" ? `url(#hatch-${uid})` : "#ffffff"}
            fillOpacity={o.stijl === "licht" ? 0.28 : o.stijl === "omlijnd" ? 0.1 : 1}
            stroke={theme.accent}
            strokeWidth={u * 0.16}
            strokeOpacity={o.stijl === "gearceerd" ? 0.5 : 0.95}
            strokeDasharray={o.stijl === "omlijnd" ? `${u * 0.7} ${u * 0.45}` : undefined}
            strokeLinejoin="round"
          />
          {o.label && <Label x={minX + u * 0.6} y={maxY - u * 0.9} text={o.label} u={u} anchor="start" W={W} />}
        </g>
      );
    }
    case "tekst": {
      const p = at(o.x, o.y);
      return <Label x={p.x} y={p.y} text={o.tekst} u={u} anchor="middle" W={W} />;
    }
    case "pijl": {
      const a = at(o.van_x, o.van_y);
      const b = at(o.naar_x, o.naar_y);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const bend = (o.buiging ?? 0) * len;
      const c = { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend };
      const cl = Math.hypot(b.x - c.x, b.y - c.y) || 1;
      const end = { x: b.x - ((b.x - c.x) / cl) * u * 1.4, y: b.y - ((b.y - c.y) / cl) * u * 1.4 };
      const el = Math.hypot(end.x - c.x, end.y - c.y) || 1;
      const ux = (end.x - c.x) / el;
      const uy = (end.y - c.y) / el;
      const h = u * 0.85;
      return (
        <g filter={`url(#shadow-${uid})`}>
          <path
            d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`}
            fill="none"
            stroke={theme.accent}
            strokeWidth={u * 0.22}
            strokeLinecap="round"
            strokeDasharray={o.pijl === "loop" ? `${u * 0.6} ${u * 0.45}` : undefined}
          />
          <polygon
            points={`${end.x + ux * h * 0.4},${end.y + uy * h * 0.4} ${end.x - ux * h - uy * h * 0.55},${end.y - uy * h + ux * h * 0.55} ${end.x - ux * h + uy * h * 0.55},${end.y - uy * h - ux * h * 0.55}`}
            fill={theme.accent}
          />
        </g>
      );
    }
    case "doel":
    case "minidoel": {
      const p = at(o.x, o.y);
      const w = o.soort === "doel" ? Math.min(7.32, W * 0.12) : u * 2.4;
      const d = o.soort === "doel" ? u * 1.5 : u * 1.2;
      return (
        <g filter={`url(#shadow-${uid})`}>
          <rect x={p.x - w / 2} y={p.y - d / 2} width={w} height={d} fill="#1f2937" fillOpacity={0.25} />
          <rect x={p.x - w / 2} y={p.y - d / 2} width={w} height={d} fill={`url(#net-${uid})`} stroke="#ffffff" strokeWidth={u * 0.16} rx={u * 0.08} />
        </g>
      );
    }
    case "ballen": {
      const p = at(o.x, o.y);
      return (
        <g>
          {[-1, 0, 1].map((i) => (
            <Ball key={i} x={p.x + i * u * 0.75} y={p.y + i * u * 0.45} r={u * 0.5} uid={uid} />
          ))}
        </g>
      );
    }
    case "kegel": {
      const p = at(o.x, o.y);
      return <polygon points={`${p.x},${p.y - u * 0.6} ${p.x - u * 0.5},${p.y + u * 0.4} ${p.x + u * 0.5},${p.y + u * 0.4}`} fill="#f59e0b" stroke="#b45309" strokeWidth={u * 0.08} />;
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
      strokeOpacity={0.35}
      strokeWidth={u * 0.25}
    >
      {text}
    </text>
  );
}

function Ball({ x, y, r, uid }: { x: number; y: number; r: number; uid: string }) {
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
