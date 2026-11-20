"use client";

import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

import type { SwitcherTeam } from "./team-switcher";

const m = messages.club;

/**
 * On a team's pages: whether the coach works in his personal environment or
 * in a club's environment (the club sees the training work of a club team).
 */
export function EnvironmentBar({ teams }: { teams: SwitcherTeam[] }) {
  const pathname = usePathname();
  const teamId = /^\/teams\/([0-9a-f-]{36})/.exec(pathname)?.[1];
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  // Only coaches with a club see the bar; without clubs everything is personal anyway.
  const inClubs = teams.some((t) => t.clubId);
  if (!team.clubId && !inClubs) return null;
  return (
    // Fixed colours: the bar sits on the dark dashboard and on the app-dark pages alike.
    <p
      className="mb-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
      style={
        team.clubId
          ? {
              background: "rgba(14,165,233,0.14)",
              color: "#bae6fd",
              boxShadow: "inset 0 0 0 1px rgba(56,189,248,0.3)",
            }
          : {
              background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
            }
      }
    >
      <span className="font-bold tracking-wider uppercase">
        {team.clubId ? m.environment : m.personal}
      </span>
      <span>{team.clubId ? m.clubHint(team.clubName) : m.personalHint}</span>
    </p>
  );
}
