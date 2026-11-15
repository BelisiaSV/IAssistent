import type { ReactNode } from "react";

/** The head coach, the coordinator of the staff and the staff roles (ids as in /staff). */
export type StaffMember = "head-coach" | "coordinator" | string;

/** Colour of each member: the avatar and its accents in the side bar and on the staff page. */
export const STAFF_COLORS: Record<string, string> = {
  "head-coach": "#f5b700",
  coordinator: "#8b5cf6",
  "assistant-coach": "#22c55e",
  "physical-coach": "#ef4444",
  "tactical-coach": "#3b82f6",
  "video-analyst": "#f97316",
  "player-development": "#14b8a6",
  "team-manager": "#ec4899",
};

export function staffColor(member: StaffMember) {
  return STAFF_COLORS[member] ?? "#64748b";
}

/** The tool of each member, drawn in a 24 × 24 badge. */
const TOOLS: Record<string, ReactNode> = {
  "head-coach": <path d="M12 3l7 3v5c0 4.5-3 8-7 9.5C8 19 5 15.5 5 11V6zM9 11.5l2 2 4-4" />,
  coordinator: (
    <>
      <circle cx="12" cy="5.5" r="2.5" />
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M12 8v4M12 12l-5 4M12 12l5 4" />
    </>
  ),
  "assistant-coach": (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9.5 3h5v3h-5zM9 10h6M9 14h6M9 18h3" />
    </>
  ),
  "physical-coach": (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5l3-3M10 3h4M12 3v3.5" />
    </>
  ),
  "tactical-coach": (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="M7 9l2 2M9 9l-2 2M16 13.5a1.5 1.5 0 1 0 0-.01M9 14c2 1.5 4 1.5 5.5-.5" />
    </>
  ),
  "video-analyst": (
    <>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 11l5-3v8l-5-3z" />
    </>
  ),
  "player-development": (
    <>
      <path d="M4 19l5-6 4 3 7-9" />
      <path d="M15 7h5v5" />
    </>
  ),
  "team-manager": (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <path d="M16 5.5a3 3 0 0 1 0 5.5M18 13.8c1.6.8 2.5 2.6 2.5 5.2" />
    </>
  ),
};

/**
 * A staff member as a person you talk to: a figure in the member's colour
 * with the tool of the role in a badge. `size` is the width in pixels.
 */
export function RoleAvatar({ member, size = 40, muted = false }: { member: StaffMember; size?: number; muted?: boolean }) {
  const color = muted ? "#64748b" : staffColor(member);
  const id = `avatar-${member}-${muted ? "m" : "c"}`;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.95" />
            <stop offset="1" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <circle cx="24" cy="24" r="23" />
          </clipPath>
        </defs>
        <circle cx="24" cy="24" r="23" fill={`url(#${id})`} />
        <g clipPath={`url(#${id}-clip)`} fill="#0b1220" fillOpacity="0.82">
          <circle cx="24" cy="19" r="8" />
          <path d="M8 48c0-10 7-17 16-17s16 7 16 17z" />
        </g>
        <circle cx="24" cy="24" r="23" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
      </svg>
      <span
        className="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full ring-2 ring-[#0b1220]"
        style={{ width: size * 0.48, height: size * 0.48, backgroundColor: color }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.3}
          height={size * 0.3}
          fill="none"
          stroke="#0b1220"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {TOOLS[member]}
        </svg>
      </span>
    </span>
  );
}
