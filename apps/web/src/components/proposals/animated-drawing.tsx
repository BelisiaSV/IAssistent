"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Keyframe: [seconds, x %, y %] (x 0 = left, y 0 = top = goal we attack). */
type Key = [number, number, number];

export interface Animation {
  titel: string;
  duur_s: number;
  veld: { type: "volledig" | "half" | "zone"; breedte_m: number; lengte_m: number };
  raster?: { x_m: number[]; y_m: number[] };
  vast: Overlay[];
  overlays: Overlay[];
  spelers: { id: string; team: "eigen" | "tegenstander" | "neutraal"; label: string | null; soort: "speler" | "doelman"; pad: Key[] }[];
  bal: Key[];
}

type Overlay =
  | { soort: "zone"; van: number; tot: number; stijl: "licht" | "gearceerd"; x: number; y: number; breedte: number; hoogte: number; label?: string; label_pos?: string }
  | { soort: "tekst"; van: number; tot: number; x: number; y: number; tekst: string }
  | { soort: "pijl"; pijl: "pass" | "loop" | "dribbel" | "schot"; van: number; tot: number; van_x: number; van_y: number; naar_x: number; naar_y: number; buiging?: number; label?: string | null }
  | { soort: "doel" | "minidoel"; x: number; y: number; van?: number; tot?: number };

const SPEEDS = [0.5, 1, 2];

function position(pad: Key[], t: number): [number, number] {
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

/**
 * Animated exercise (players, ball, zones, arrows and labels over time) in the
 * house style: dark striped pitch, zone grid, white players with numbers.
 */
export function AnimatedDrawing({
  animation,
  logoUrl,
  autoPlay = false,
  labels,
}: {
  animation: Animation;
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
  const u = Math.max(W, L) / 40;
  const pad = u * 1.2;
  const at = (x: number, y: number) => ({ x: (x / 100) * W, y: (y / 100) * L });
  const visible = (o: { van?: number; tot?: number }) => (o.van ?? 0) <= t && t < (o.tot ?? Infinity);
  const ball = position(animation.bal, t);
  const stripes = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-[#0d4f2c]">
        <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${L + 2 * pad}`} className="mx-auto block max-h-[80vh] w-full" role="img" aria-label={animation.titel}>
          <defs>
            <pattern id={`hatch-${uid}`} width={u * 0.9} height={u * 0.9} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
              <rect width={u * 0.9} height={u * 0.9} fill="#22305f" fillOpacity={0.55} />
              <line x1={0} y1={0} x2={0} y2={u * 0.9} stroke="#7d6bd6" strokeWidth={u * 0.22} strokeOpacity={0.7} />
            </pattern>
            <filter id={`shadow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx={0} dy={u * 0.12} stdDeviation={u * 0.12} floodColor="#000" floodOpacity={0.45} />
            </filter>
          </defs>

          {/* Pitch with mowing stripes */}
          <rect x={-pad} y={-pad} width={W + 2 * pad} height={L + 2 * pad} fill="#0d4f2c" />
          {stripes.map((i) => (
            <rect key={i} x={0} y={(L / 12) * i} width={W} height={L / 12} fill={i % 2 ? "#0f5a32" : "#0d522e"} />
          ))}

          {/* Zone grid */}
          <g stroke="#ffffff" strokeOpacity={0.18} strokeWidth={u * 0.08}>
            {animation.raster?.x_m.map((x) => <line key={`x${x}`} x1={x} y1={0} x2={x} y2={L} />)}
            {animation.raster?.y_m.map((y) => <line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />)}
          </g>

          <PitchLines W={W} L={L} u={u} />

          {[...animation.vast, ...animation.overlays].filter(visible).map((o, i) => (
            <OverlayView key={i} overlay={o} at={at} u={u} W={W} uid={uid} />
          ))}

          {animation.spelers.map((p) => {
            const [x, y] = position(p.pad, t);
            const q = at(x, y);
            const own = p.team === "eigen";
            return (
              <g key={p.id} filter={`url(#shadow-${uid})`}>
                <circle cx={q.x} cy={q.y} r={u * 0.95} fill={own ? "#ffffff" : "#f0565c"} stroke={own ? "#1e293b" : "#ffffff"} strokeWidth={u * (p.soort === "doelman" ? 0.18 : 0.06)} />
                {p.label && (
                  <text x={q.x} y={q.y} fontSize={u * 1.05} fontWeight={800} fill="#111827" textAnchor="middle" dominantBaseline="central">
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}

          <Ball x={at(ball[0], ball[1]).x} y={at(ball[0], ball[1]).y} u={u} uid={uid} />
        </svg>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="pointer-events-none absolute top-3 right-3 h-14 w-14 rounded-md object-contain" />
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
          className="min-w-40 flex-1"
          aria-label="tijd"
        />
        <span className="w-20 text-right tabular-nums text-slate-600">
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

function PitchLines({ W, L, u }: { W: number; L: number; u: number }) {
  const s = { fill: "none", stroke: "#ffffff", strokeWidth: u * 0.16 };
  const box = (y: number, down: boolean) => (
    <g>
      <rect x={(W - 40.32) / 2} y={down ? y : y - 16.5} width={40.32} height={16.5} {...s} />
      <rect x={(W - 18.32) / 2} y={down ? y : y - 5.5} width={18.32} height={5.5} {...s} />
      <circle cx={W / 2} cy={down ? y + 11 : y - 11} r={u * 0.18} fill="#ffffff" />
      <path d={down ? `M ${W / 2 - 7.3} ${y + 16.5} A 9.15 9.15 0 0 0 ${W / 2 + 7.3} ${y + 16.5}` : `M ${W / 2 - 7.3} ${y - 16.5} A 9.15 9.15 0 0 1 ${W / 2 + 7.3} ${y - 16.5}`} {...s} />
      <rect x={W / 2 - 3.66} y={down ? y - 1.6 : y} width={7.32} height={1.6} fill="#ffffff" fillOpacity={0.25} stroke="#ffffff" strokeWidth={u * 0.1} />
    </g>
  );
  return (
    <g>
      <rect x={0} y={0} width={W} height={L} {...s} />
      <line x1={0} y1={L / 2} x2={W} y2={L / 2} {...s} />
      <circle cx={W / 2} cy={L / 2} r={9.15} {...s} />
      <circle cx={W / 2} cy={L / 2} r={u * 0.18} fill="#ffffff" />
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
}: {
  overlay: Overlay;
  at: (x: number, y: number) => { x: number; y: number };
  u: number;
  W: number;
  uid: string;
}) {
  switch (o.soort) {
    case "zone": {
      const p = at(o.x, o.y);
      const q = at(o.x + o.breedte, o.y + o.hoogte);
      return (
        <g>
          <rect
            x={p.x}
            y={p.y}
            width={q.x - p.x}
            height={q.y - p.y}
            fill={o.stijl === "licht" ? "#ffffff" : `url(#hatch-${uid})`}
            fillOpacity={o.stijl === "licht" ? 0.32 : 1}
          />
          {o.label && <Label x={p.x + u * 0.6} y={q.y - u * 0.9} text={o.label} u={u} anchor="start" W={W} />}
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
      // Stop a bit before the receiver and point the head along the curve's end tangent.
      const end = { x: b.x - ((b.x - c.x) / Math.hypot(b.x - c.x, b.y - c.y)) * u * 1.3, y: b.y - ((b.y - c.y) / Math.hypot(b.x - c.x, b.y - c.y)) * u * 1.3 };
      const ex = end.x - c.x;
      const ey = end.y - c.y;
      const el = Math.hypot(ex, ey) || 1;
      const ux = ex / el;
      const uy = ey / el;
      const h = u * 0.8;
      return (
        <g>
          <path d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`} fill="none" stroke="#ffffff" strokeWidth={u * 0.2} strokeLinecap="round" strokeDasharray={o.pijl === "loop" ? `${u * 0.6} ${u * 0.4}` : undefined} />
          <polygon
            points={`${end.x + ux * h * 0.4},${end.y + uy * h * 0.4} ${end.x - ux * h - uy * h * 0.5},${end.y - uy * h + ux * h * 0.5} ${end.x - ux * h + uy * h * 0.5},${end.y - uy * h - ux * h * 0.5}`}
            fill="#ffffff"
          />
        </g>
      );
    }
    case "doel":
    case "minidoel": {
      const p = at(o.x, o.y);
      const w = o.soort === "doel" ? Math.min(7.32, W * 0.12) : u * 2.2;
      const d = o.soort === "doel" ? u * 1.4 : u * 1.1;
      return (
        <g>
          <rect x={p.x - w / 2} y={p.y - d / 2} width={w} height={d} fill={`url(#net-${uid})`} stroke="#ffffff" strokeWidth={u * 0.14} />
          <pattern id={`net-${uid}`} width={u * 0.35} height={u * 0.35} patternUnits="userSpaceOnUse">
            <path d={`M 0 0 L ${u * 0.35} ${u * 0.35} M ${u * 0.35} 0 L 0 ${u * 0.35}`} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={u * 0.04} />
          </pattern>
        </g>
      );
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

function Ball({ x, y, u, uid }: { x: number; y: number; u: number; uid: string }) {
  const r = u * 0.62;
  return (
    <g filter={`url(#shadow-${uid})`}>
      <circle cx={x} cy={y} r={r} fill="#ffffff" stroke="#111827" strokeWidth={u * 0.12} />
      <polygon
        points={Array.from({ length: 5 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          return `${x + Math.cos(a) * r * 0.42},${y + Math.sin(a) * r * 0.42}`;
        }).join(" ")}
        fill="#111827"
      />
    </g>
  );
}
