import type { ReactNode } from "react";

/**
 * A staff member as a small figure with the tool of the role: clipboard
 * (assistant coach), tactics board (tactical coach), stopwatch (physical
 * coach) and camera (video analyst). Unknown roles get the figure only.
 */
export function RoleFigure({ role, color, className = "h-14 w-14" }: { role: string; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="32" cy="32" r="31" fill={color} opacity="0.12" />
      {/* Figure: head and shoulders in a training top. */}
      <circle cx="26" cy="22" r="8" fill={color} />
      <path d="M10 54c0-10 7-17 16-17s16 7 16 17" fill={color} />
      <path d="M22 37l4 6 4-6" stroke="#fff" strokeWidth="2" opacity="0.8" />
      {TOOLS[role]?.(color)}
    </svg>
  );
}

const TOOLS: Record<string, (color: string) => ReactNode> = {
  "assistant-coach": (c) => (
    <g>
      <rect x="38" y="26" width="17" height="22" rx="2.5" fill="#fff" stroke={c} strokeWidth="2.5" />
      <rect x="42.5" y="23.5" width="8" height="5" rx="1.5" fill={c} />
      <path d="M42 34h9M42 39h9M42 44h6" stroke={c} strokeWidth="2" />
    </g>
  ),
  "tactical-coach": (c) => (
    <g>
      <rect x="36" y="20" width="22" height="18" rx="2.5" fill="#fff" stroke={c} strokeWidth="2.5" />
      <path d="M40 25l4 4M44 25l-4 4" stroke={c} strokeWidth="2" />
      <circle cx="52" cy="32" r="2.5" stroke={c} strokeWidth="2" />
      <path d="M43 33c3 2 5 2 7-1" stroke={c} strokeWidth="2" strokeDasharray="2 2" />
      <path d="M47 38v8M43 48l4-2 4 2" stroke={c} strokeWidth="2.5" />
    </g>
  ),
  "physical-coach": (c) => (
    <g>
      <circle cx="47" cy="38" r="10" fill="#fff" stroke={c} strokeWidth="2.5" />
      <path d="M47 24v4M44 24h6M47 38l4-4" stroke={c} strokeWidth="2.5" />
      <path d="M55 29l2-2" stroke={c} strokeWidth="2.5" />
    </g>
  ),
  "video-analyst": (c) => (
    <g>
      <rect x="36" y="30" width="16" height="13" rx="2.5" fill="#fff" stroke={c} strokeWidth="2.5" />
      <path d="M52 34l6-3v11l-6-3z" fill={c} />
      <circle cx="44" cy="36.5" r="3" stroke={c} strokeWidth="2" />
      <circle cx="40" cy="26" r="3.5" stroke={c} strokeWidth="2" />
      <circle cx="48" cy="26" r="3.5" stroke={c} strokeWidth="2" />
    </g>
  ),
};
