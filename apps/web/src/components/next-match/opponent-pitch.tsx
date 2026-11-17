import type { SlideLineup } from "@/lib/presentation/types";

/** The lineup of the opponent on a pitch: the goal at the bottom, a shirt colour per player. */
export function OpponentPitch({ lineup, shirt, trim }: { lineup: SlideLineup; shirt: string | null; trim: string | null }) {
  const body = shirt ?? "#e2e8f0";
  const edge = trim ?? "#334155";
  return (
    <div
      className="relative mx-auto aspect-[68/90] w-full max-w-md overflow-hidden rounded-xl"
      style={{ background: "repeating-linear-gradient(0deg, #1d9a52 0 9%, #22a85b 9% 18%)" }}
    >
      <svg viewBox="0 0 68 90" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5">
          <rect x="2" y="2" width="64" height="86" />
          <line x1="2" y1="45" x2="66" y2="45" />
          <circle cx="34" cy="45" r="7" />
          <rect x="16" y="2" width="36" height="13" />
          <rect x="16" y="75" width="36" height="13" />
        </g>
      </svg>
      {lineup.players.map((p, i) => (
        <div key={i} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${p.x}%`, top: `${6 + p.y * 0.88}%` }}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shadow"
            style={p.goalkeeper ? { background: edge, color: body, border: `2px solid ${body}` } : { background: body, color: edge, border: `2px solid ${edge}` }}
          >
            {p.number ?? ""}
          </span>
          <span className="mt-0.5 max-w-24 truncate rounded bg-black/55 px-1.5 text-[11px] font-medium text-white">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
