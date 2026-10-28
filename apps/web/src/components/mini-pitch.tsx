import type { FormationSlot } from "@iassistent/staff-engine/content";

/** A small portrait pitch with the slots of a formation: filled dots are picked, rings are open. */
export function MiniPitch({ slots, filled, color }: { slots: FormationSlot[]; filled: ReadonlySet<string>; color: string }) {
  return (
    <svg viewBox="0 0 68 105" className="h-full w-full" aria-hidden>
      <rect width="68" height="105" rx="4" fill="#13232f" />
      <g fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6">
        <rect x="3" y="3" width="62" height="99" />
        <line x1="3" y1="52.5" x2="65" y2="52.5" />
        <circle cx="34" cy="52.5" r="8" />
        <rect x="15" y="3" width="38" height="15" />
        <rect x="15" y="87" width="38" height="15" />
      </g>
      {slots.map((s) => {
        const x = 3 + (62 * s.x) / 100;
        const y = 3 + (99 * s.y) / 100;
        return filled.has(s.id) ? (
          <circle key={s.id} cx={x} cy={y} r="4.2" fill={color} stroke="#fff" strokeWidth="0.8" />
        ) : (
          <circle key={s.id} cx={x} cy={y} r="3.8" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" strokeDasharray="1.6 1.2" />
        );
      })}
    </svg>
  );
}
