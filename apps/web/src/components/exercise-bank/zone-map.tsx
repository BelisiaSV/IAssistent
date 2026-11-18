import { ZONE_COUNT } from "@/lib/exercise-bank/zones";

const W = 68;
const H = 105;
const PAD = 2;
/** Columns: left wing, centre, right wing (as in the zone map of the exercise database). */
const COLS = [0, 0.2, 0.8, 1];
const ROWS = 6;

/** Zone 1 is bottom left (own goal), zone 18 top right (opponent's goal). */
function zoneRect(zone: number) {
  const row = Math.floor((zone - 1) / 3);
  const col = (zone - 1) % 3;
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;
  const x = PAD + innerW * COLS[col]!;
  const w = innerW * (COLS[col + 1]! - COLS[col]!);
  const h = innerH / ROWS;
  const y = PAD + innerH - (row + 1) * h;
  return { x, y, w, h };
}

/**
 * The pitch in 18 zones with the zones of an exercise highlighted. With
 * `onToggle` every zone is a button (used by the admin to edit the zones).
 */
export function ZoneMap({ zones, onToggle, className = "" }: { zones: number[]; onToggle?: (zone: number) => void; className?: string }) {
  const active = new Set(zones);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role={onToggle ? "group" : "img"} aria-label={`Zones ${zones.join(", ")}`}>
      <rect width={W} height={H} rx="2" fill="#173d2c" />
      {Array.from({ length: ZONE_COUNT }, (_, i) => i + 1).map((zone) => {
        const r = zoneRect(zone);
        const on = active.has(zone);
        return (
          <g
            key={zone}
            onClick={onToggle ? () => onToggle(zone) : undefined}
            style={onToggle ? { cursor: "pointer" } : undefined}
            role={onToggle ? "checkbox" : undefined}
            aria-checked={onToggle ? on : undefined}
            aria-label={onToggle ? `Zone ${zone}` : undefined}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={on ? "#a08c3c" : zone > 12 ? "#1f4a35" : "#1a4230"} />
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="6"
              fontWeight="800"
              fill={on ? "#1c1917" : "#f8fafc"}
              stroke={on ? "#f5c044" : "none"}
              strokeWidth={on ? 0.35 : 0}
              paintOrder="stroke"
            >
              {zone}
            </text>
          </g>
        );
      })}
      <g fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" pointerEvents="none">
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} />
        <circle cx={W / 2} cy={H / 2} r="7" />
        <rect x={PAD + (W - 2 * PAD) * 0.2} y={PAD} width={(W - 2 * PAD) * 0.6} height={(H - 2 * PAD) / 6} />
        <rect x={PAD + (W - 2 * PAD) * 0.2} y={H - PAD - (H - 2 * PAD) / 6} width={(W - 2 * PAD) * 0.6} height={(H - 2 * PAD) / 6} />
        <rect x={W / 2 - 9} y={PAD} width="18" height="5" />
        <rect x={W / 2 - 9} y={H - PAD - 5} width="18" height="5" />
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.3" strokeDasharray="1.2 1" pointerEvents="none">
        {Array.from({ length: ROWS - 1 }, (_, i) => {
          const y = PAD + ((H - 2 * PAD) * (i + 1)) / ROWS;
          return <line key={`r${i}`} x1={PAD} y1={y} x2={W - PAD} y2={y} />;
        })}
        {[0.2, 0.8].map((c) => {
          const x = PAD + (W - 2 * PAD) * c;
          return <line key={c} x1={x} y1={PAD} x2={x} y2={H - PAD} />;
        })}
      </g>
    </svg>
  );
}
