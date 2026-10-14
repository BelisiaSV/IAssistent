import type { ReactNode } from "react";

/** Dark full pitch (portrait) with absolutely positioned children in % coordinates. */
export function Pitch({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto aspect-[68/105] w-full max-w-xl overflow-hidden rounded-xl bg-[#13232f]">
      <svg viewBox="0 0 68 105" className="absolute inset-0 h-full w-full" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4">
          <rect x="2" y="2" width="64" height="101" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.85" y="2" width="40.3" height="16.5" />
          <rect x="24.85" y="2" width="18.3" height="5.5" />
          <rect x="13.85" y="86.5" width="40.3" height="16.5" />
          <rect x="24.85" y="97.5" width="18.3" height="5.5" />
        </g>
      </svg>
      {children}
    </div>
  );
}
