"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const LAST_TEAM_KEY = "iassistent.team";
const noSubscribe = () => () => {};

function readLastTeam() {
  try {
    return localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
}

/**
 * The team the platform works on: the team in the address, else the last one
 * used (remembered in this browser), else the first active team.
 */
export function useCurrentTeam(teams: readonly { id: string; archived: boolean }[]) {
  const pathname = usePathname();
  const routeTeam = /^\/teams\/([0-9a-f-]{36})/.exec(pathname)?.[1] ?? null;
  const lastTeam = useSyncExternalStore(noSubscribe, readLastTeam, () => null);

  useEffect(() => {
    if (!routeTeam) return;
    try {
      localStorage.setItem(LAST_TEAM_KEY, routeTeam);
    } catch {
      // Storage blocked: the first team is used instead.
    }
  }, [routeTeam]);

  return [routeTeam, lastTeam].find((id) => id && teams.some((t) => t.id === id)) ?? teams.find((t) => !t.archived)?.id ?? teams[0]?.id ?? null;
}
