import type { NavIconName } from "@/components/nav-icons";

import { messages } from "./messages";

const m = messages.nav;

export interface NavSection {
  label: string;
  icon: NavIconName;
  /** Path under the current team, null when not built yet. */
  teamPath?: string | null;
  /** Path outside the team (may carry a query, e.g. a filter). */
  href?: string;
  /** Active only on exactly this path. */
  exact?: boolean;
}

export interface NavGroup {
  /** "head-coach" or the id of a staff role in /staff. */
  member: string;
  sections: NavSection[];
}

/**
 * The side bar follows the staff: the head coach on top, then every role
 * with the parts of the platform it is responsible for.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    member: "head-coach",
    sections: [
      { label: m.dashboard, icon: "dashboard", teamPath: "", exact: true },
      { label: m.staff, icon: "staff", teamPath: "/staff" },
      { label: m.vision, icon: "vision", href: "/profile/vision" },
      { label: m.settings, icon: "settings", teamPath: "/settings" },
    ],
  },
  {
    member: "assistant-coach",
    sections: [
      { label: m.microcycle, icon: "microcycle", teamPath: "/weeks" },
      { label: m.exercises, icon: "exercises", href: "/exercises" },
      { label: m.editor, icon: "editor", teamPath: null },
    ],
  },
  {
    member: "physical-coach",
    sections: [
      { label: m.load, icon: "load", teamPath: "/load" },
      { label: m.periodization, icon: "periodization", teamPath: "/periodization" },
      { label: m.tests, icon: "tests", teamPath: "/tests" },
    ],
  },
  {
    member: "video-analyst",
    sections: [
      { label: m.presentations, icon: "presentations", teamPath: null },
      { label: m.evaluations, icon: "evaluations", teamPath: null },
      { label: m.videos, icon: "videos", teamPath: null },
      { label: m.animations, icon: "animations", teamPath: null },
    ],
  },
  {
    member: "tactical-coach",
    sections: [
      { label: m.matchPlan, icon: "matchday", teamPath: "/match" },
      { label: m.opponents, icon: "opponents", teamPath: "/opponents" },
      { label: m.setPieces, icon: "setPieces", href: "/exercises?soort=set_piece" },
    ],
  },
  {
    member: "player-development",
    sections: [
      { label: m.development, icon: "development", teamPath: null },
      { label: m.clubGoals, icon: "goals", teamPath: null },
    ],
  },
  {
    member: "team-manager",
    sections: [
      { label: m.selection, icon: "lineup", teamPath: "/lineups" },
      { label: m.players, icon: "players", teamPath: "/players" },
    ],
  },
];

/** The href of a section for a team, or null when it cannot open (not built yet, or no team). */
export function sectionHref(section: NavSection, teamId: string | null): string | null {
  if (section.href) return section.href;
  if (section.teamPath === null || section.teamPath === undefined || !teamId) return null;
  return `/teams/${teamId}${section.teamPath}`;
}

/**
 * Whether a section is the current page. A section with a query (a filter)
 * only matches with that query; a section without one yields to it.
 */
export function isActive(section: NavSection, href: string, pathname: string, search: URLSearchParams, all: NavSection[]): boolean {
  const [path, query] = href.split("?");
  const onPath = section.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  if (!onPath) return false;
  if (query) return [...new URLSearchParams(query)].every(([k, v]) => search.get(k) === v);
  return !all.some((other) => {
    const [otherPath, otherQuery] = (other.href ?? "").split("?");
    return otherQuery && otherPath === path && [...new URLSearchParams(otherQuery)].every(([k, v]) => search.get(k) === v);
  });
}
