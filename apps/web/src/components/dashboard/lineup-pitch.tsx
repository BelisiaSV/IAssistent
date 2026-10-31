import type { FormationSlot } from "@iassistent/staff-engine/content";

import { readableOn } from "@/lib/proposals/overview";

export interface LineupSpot {
  slot: FormationSlot;
  player: { number: number | null; name: string } | null;
}

/** A small pitch with the starting eleven of a lineup: shirt number in a disc, name below. */
export function LineupPitch({ spots, color }: { spots: LineupSpot[]; color: string }) {
  return (
    <div className="relative mx-auto aspect-[68/100] h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl ring-2 ring-white/70">
      <svg viewBox="0 0 68 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="0" y={i * 12.5} width="68" height="12.5" fill={i % 2 ? "#2f8f46" : "#33994b"} />
        ))}
        <g fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.4">
          <rect x="3" y="3" width="62" height="94" />
          <line x1="3" y1="50" x2="65" y2="50" />
          <circle cx="34" cy="50" r="8" />
          <rect x="17" y="3" width="34" height="12" />
          <rect x="17" y="85" width="34" height="12" />
        </g>
      </svg>
      {spots.map(({ slot, player }) => (
        <div
          key={slot.id}
          className="absolute flex w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center"
          style={{ left: `${slot.x}%`, top: `${Math.min(slot.y, 90)}%` }}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black shadow ring-2 ring-white/80 ${player ? "" : "opacity-50"}`}
            style={{ backgroundColor: player ? color : "#0f172a", color: player ? readableOn(color) : "#fff" }}
          >
            {player?.number ?? slot.positie}
          </span>
          {player && <span className="mt-0.5 max-w-full truncate rounded bg-slate-950/80 px-1 text-[9px] font-semibold text-white">{player.name}</span>}
        </div>
      ))}
    </div>
  );
}
