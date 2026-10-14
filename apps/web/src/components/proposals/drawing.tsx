import { messages } from "@/lib/messages";
import type { Drawing } from "@/lib/proposals/types";

const d = messages.drawings;

// Light field so drawings print well; team colours from the dataviz palette.
const FIELD = "#eaf4e6";
const LINE = "#7aa36f";
const INK = "#1e293b";
const TEAM_COLORS = { eigen: "#2a78d6", tegenstander: "#eb6834", neutraal: "#e3b505" } as const;
const ARROW_COLORS = { pass: INK, loop: INK, dribbel: INK, schot: "#c62828" } as const;

type Point = { x: number; y: number };

/**
 * Renders a drawing of the Tactical Coach (exercise or set piece) as SVG.
 * Everything is in metres of the drawn field; sizes scale with its long side.
 */
export function DrawingView({ drawing, className = "" }: { drawing: Drawing; className?: string }) {
  const W = Math.max(5, drawing.veld.breedte_m);
  const H = Math.max(5, drawing.veld.lengte_m);
  const u = Math.max(W, H) / 40;
  const pad = u * 1.5;
  const at = (x: number, y: number): Point => ({ x: (x / 100) * W, y: (y / 100) * H });

  const usedTeams = new Set(drawing.elementen.filter((e) => e.soort === "speler").map((e) => e.team ?? "neutraal"));
  const usedArrows = new Set(drawing.pijlen.map((p) => p.soort));

  return (
    <figure className={`space-y-2 ${className}`}>
      <svg
        viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`}
        className="mx-auto block max-h-[70vh] w-full print:max-h-none"
        role="img"
        aria-label={drawing.titel}
      >
        <rect x={-pad} y={-pad} width={W + 2 * pad} height={H + 2 * pad} fill={FIELD} rx={u} />
        <Markings type={drawing.veld.type} W={W} H={H} u={u} />

        {drawing.zones.map((z, i) => {
          const p = at(z.x, z.y);
          const w = (z.breedte / 100) * W;
          const h = (z.hoogte / 100) * H;
          return (
            <g key={`z${i}`}>
              <rect x={p.x} y={p.y} width={w} height={h} fill="#2a78d6" fillOpacity={0.08} stroke="#2a78d6" strokeWidth={u * 0.12} strokeDasharray={`${u * 0.6} ${u * 0.4}`} />
              {z.label && (
                <text x={p.x + u * 0.5} y={p.y + h - u * 0.5} fontSize={u * 0.9} fill="#1d5fae" fontWeight={600}>
                  {z.label}
                </text>
              )}
            </g>
          );
        })}

        {drawing.pijlen.map((a, i) => (
          <Arrow key={`a${i}`} from={at(a.van_x, a.van_y)} to={at(a.naar_x, a.naar_y)} kind={a.soort} label={a.label} u={u} />
        ))}

        {drawing.elementen.map((e, i) => (
          <Element key={`e${i}`} element={e} p={at(e.x, e.y)} u={u} W={W} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {(["eigen", "tegenstander", "neutraal"] as const)
          .filter((t) => usedTeams.has(t))
          .map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: TEAM_COLORS[t] }} />
              {t === "eigen" ? d.legend.own : t === "tegenstander" ? d.legend.opponent : d.legend.neutral}
            </span>
          ))}
        {usedArrows.has("pass") && <LegendLine dash label={d.legend.pass} />}
        {usedArrows.has("loop") && <LegendLine label={d.legend.run} />}
        {usedArrows.has("dribbel") && <LegendLine wavy label={d.legend.dribble} />}
        {usedArrows.has("schot") && <LegendLine color={ARROW_COLORS.schot} label={d.legend.shot} />}
      </figcaption>
    </figure>
  );
}

function Markings({ type, W, H, u }: { type: Drawing["veld"]["type"]; W: number; H: number; u: number }) {
  const stroke = { fill: "none", stroke: LINE, strokeWidth: u * 0.15 };
  if (type === "zone" || W < 45 || H < 30) return <rect x={0} y={0} width={W} height={H} {...stroke} />;

  // Penalty area, goal area and penalty spot at the goal line y.
  const box = (y: number, down: boolean) => {
    const dir = down ? 1 : -1;
    return (
      <g>
        <rect x={(W - 40.32) / 2} y={down ? y : y - 16.5} width={40.32} height={16.5} {...stroke} />
        <rect x={(W - 18.32) / 2} y={down ? y : y - 5.5} width={18.32} height={5.5} {...stroke} />
        <circle cx={W / 2} cy={y + dir * 11} r={u * 0.2} fill={LINE} />
      </g>
    );
  };

  if (type === "half") {
    const r = Math.min(9.15, W / 4);
    return (
      <g>
        <rect x={0} y={0} width={W} height={H} {...stroke} />
        {box(0, true)}
        {H >= 45 && <path d={`M ${W / 2 - r} ${H} A ${r} ${r} 0 0 1 ${W / 2 + r} ${H}`} {...stroke} />}
      </g>
    );
  }
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} {...stroke} />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} {...stroke} />
      <circle cx={W / 2} cy={H / 2} r={Math.min(9.15, W / 4)} {...stroke} />
      {box(0, true)}
      {box(H, false)}
    </g>
  );
}

function Element({ element, p, u, W }: { element: Drawing["elementen"][number]; p: Point; u: number; W: number }) {
  switch (element.soort) {
    case "speler":
    case "doelman": {
      const color = TEAM_COLORS[element.team ?? "neutraal"];
      const r = u * 0.95;
      return (
        <g>
          <circle cx={p.x} cy={p.y} r={r} fill={color} stroke={element.soort === "doelman" ? INK : "white"} strokeWidth={u * (element.soort === "doelman" ? 0.25 : 0.15)} />
          {element.label && (
            <text x={p.x} y={p.y} fontSize={u * (element.label.length > 2 ? 0.7 : 0.95)} fill="white" fontWeight={700} textAnchor="middle" dominantBaseline="central">
              {element.label}
            </text>
          )}
        </g>
      );
    }
    case "kegel":
      return (
        <polygon
          points={`${p.x},${p.y - u * 0.55} ${p.x - u * 0.45},${p.y + u * 0.35} ${p.x + u * 0.45},${p.y + u * 0.35}`}
          fill="#f59e0b"
          stroke="#b45309"
          strokeWidth={u * 0.08}
        />
      );
    case "bal":
      return <circle cx={p.x} cy={p.y} r={u * 0.4} fill="white" stroke={INK} strokeWidth={u * 0.12} />;
    case "paal":
      return <rect x={p.x - u * 0.15} y={p.y - u * 0.8} width={u * 0.3} height={u * 1.6} fill="#facc15" stroke={INK} strokeWidth={u * 0.06} />;
    case "doel":
    case "minidoel": {
      const w = element.soort === "doel" ? Math.min(7.32, W * 0.3) : Math.min(2, W * 0.12);
      const h = element.soort === "doel" ? u * 0.8 : u * 0.6;
      return <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} fill="white" stroke={INK} strokeWidth={u * 0.15} />;
    }
  }
}

function Arrow({
  from,
  to,
  kind,
  label,
  u,
}: {
  from: Point;
  to: Point;
  kind: Drawing["pijlen"][number]["soort"];
  label: string | null;
  u: number;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const head = u * 0.8;
  // Stop the line at the base of the arrow head.
  const end = { x: to.x - ux * head * 0.8, y: to.y - uy * head * 0.8 };
  const color = ARROW_COLORS[kind];
  const width = u * (kind === "schot" ? 0.3 : 0.18);

  let path = `M ${from.x} ${from.y} L ${end.x} ${end.y}`;
  if (kind === "dribbel") {
    const usable = Math.max(0, length - head);
    const waves = Math.max(2, Math.round(usable / (u * 1.4)));
    const amp = u * 0.35;
    const steps = waves * 8;
    path = `M ${from.x} ${from.y}`;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * usable;
      const off = Math.sin((i / steps) * waves * 2 * Math.PI) * amp;
      path += ` L ${from.x + ux * t - uy * off} ${from.y + uy * t + ux * off}`;
    }
  }

  const left = { x: to.x - ux * head - uy * head * 0.5, y: to.y - uy * head + ux * head * 0.5 };
  const right = { x: to.x - ux * head + uy * head * 0.5, y: to.y - uy * head - ux * head * 0.5 };
  const mid = { x: (from.x + to.x) / 2 - uy * u * 0.9, y: (from.y + to.y) / 2 + ux * u * 0.9 };

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={kind === "pass" ? `${u * 0.6} ${u * 0.4}` : undefined}
        strokeLinecap="round"
      />
      <polygon points={`${to.x},${to.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color} />
      {label && (
        <text x={mid.x} y={mid.y} fontSize={u * 0.8} fill={INK} textAnchor="middle" dominantBaseline="central" fontWeight={600} paintOrder="stroke" stroke={FIELD} strokeWidth={u * 0.3}>
          {label}
        </text>
      )}
    </g>
  );
}

function LegendLine({ label, dash, wavy, color = INK }: { label: string; dash?: boolean; wavy?: boolean; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="24" height="8" aria-hidden>
        {wavy ? (
          <path d="M1 4 Q4 0 7 4 T13 4 T19 4 T23 4" fill="none" stroke={color} strokeWidth="1.5" />
        ) : (
          <line x1="1" y1="4" x2="23" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray={dash ? "3 2" : undefined} />
        )}
      </svg>
      {label}
    </span>
  );
}
