import type { NavIconName } from "@/components/nav-icons";

import { messages } from "./messages";

const m = messages.nav;

/** A part of a menu, shown as a tab at the top of the page. */
export interface NavTab {
  label: string;
  /** Path under the current team, null when not built yet. */
  teamPath?: string | null;
  /** Path outside the team (may carry a query, e.g. a filter). */
  href?: string;
  /** Active only on exactly this path. */
  exact?: boolean;
  /** The staff role that takes care of this part (id in /staff). */
  member?: string;
}

/** A menu of the head coach in the side bar; it opens on its first tab. */
export interface NavItem {
  key: string;
  label: string;
  icon: NavIconName;
  tabs: NavTab[];
}

/**
 * The head coach sees only these menus; the parts inside each menu are taken
 * care of by the roles of the staff.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: m.dashboard, icon: "dashboard", tabs: [{ label: m.dashboard, teamPath: "", exact: true }] },
  {
    key: "team",
    label: m.myTeam,
    icon: "players",
    tabs: [
      { label: m.squad, teamPath: "/players", member: "team-manager" },
      { label: m.lineups, teamPath: "/lineups", member: "team-manager" },
      { label: m.settings, teamPath: "/settings" },
      { label: m.vision, href: "/profile/vision" },
    ],
  },
  {
    key: "planning",
    label: m.planning,
    icon: "microcycle",
    tabs: [
      { label: m.microcycle, teamPath: "/microcycle", member: "assistant-coach" },
      { label: m.periodization, teamPath: "/periodization", member: "physical-coach" },
      { label: m.load, teamPath: "/load", member: "physical-coach" },
    ],
  },
  { key: "staff-room", label: m.staffRoom, icon: "staff", tabs: [{ label: m.staffRoom, teamPath: "/staff-room", member: "coordinator" }] },
  { key: "tasks", label: m.tasks, icon: "tasks", tabs: [{ label: m.tasks, teamPath: "/tasks", member: "coordinator" }] },
  {
    key: "match-analysis",
    label: m.matchAnalysis,
    icon: "matchday",
    tabs: [
      { label: m.nextMatch, teamPath: "/match", member: "tactical-coach" },
      { label: m.opponents, teamPath: "/opponents", member: "tactical-coach" },
      { label: m.competition, teamPath: "/competition", member: "team-manager" },
      { label: m.presentation, teamPath: "/presentation", member: "video-analyst" },
      { label: m.evaluations, teamPath: "/evaluations", member: "video-analyst" },
    ],
  },
  {
    key: "library",
    label: m.library,
    icon: "exercises",
    tabs: [
      { label: m.exerciseList, href: "/exercises", member: "assistant-coach" },
      { label: m.setPieces, href: "/exercises?soort=set_piece", member: "tactical-coach" },
      { label: m.exerciseBank, href: "/exercises/bank", member: "assistant-coach" },
    ],
  },
  {
    key: "reports",
    label: m.reports,
    icon: "reports",
    tabs: [
      { label: m.tests, teamPath: "/tests", member: "physical-coach" },
      { label: m.seasonReport, teamPath: "/reports", exact: true, member: "video-analyst" },
      { label: m.weeklyLoad, teamPath: "/reports/load", member: "physical-coach" },
    ],
  },
];

/** The href of a tab for a team, or null when it cannot open (not built yet, or no team). */
export function tabHref(tab: NavTab, teamId: string | null): string | null {
  if (tab.href) return tab.href;
  if (tab.teamPath === null || tab.teamPath === undefined || !teamId) return null;
  return `/teams/${teamId}${tab.teamPath}`;
}

/**
 * Whether a tab is the current page. A tab with a query (a filter) only
 * matches with that query; a tab without one yields to it.
 */
export function isTabActive(tab: NavTab, href: string, pathname: string, search: URLSearchParams, all: NavTab[]): boolean {
  const [path, query] = href.split("?");
  const onPath = tab.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  if (!onPath) return false;
  // A tab deeper in the same path (e.g. /exercises/bank under /exercises) wins.
  const deeper = all.some((other) => {
    const otherPath = (other.href ?? "").split("?")[0]!;
    return otherPath.startsWith(`${path}/`) && (pathname === otherPath || pathname.startsWith(`${otherPath}/`));
  });
  if (deeper) return false;
  if (query) return [...new URLSearchParams(query)].every(([k, v]) => search.get(k) === v);
  return !all.some((other) => {
    const [otherPath, otherQuery] = (other.href ?? "").split("?");
    return otherQuery && otherPath === path && [...new URLSearchParams(otherQuery)].every(([k, v]) => search.get(k) === v);
  });
}

/** Which menu and tab the week page belongs to, by its "menu" parameter. */
export const WEEK_PAGE_MENUS: Record<string, { item: string; teamPath: string }> = {
  planning: { item: "planning", teamPath: "/microcycle" },
  match: { item: "match-analysis", teamPath: "/match" },
  load: { item: "planning", teamPath: "/load" },
};

/** The menu and tab of the current page, if any. */
export function activeNav(pathname: string, search: URLSearchParams, teamId: string | null) {
  for (const item of NAV_ITEMS) {
    for (const tab of item.tabs) {
      const href = tabHref(tab, teamId);
      if (href && isTabActive(tab, href, pathname, search, item.tabs)) return { item, tab };
    }
  }
  // The week page serves several menus: "menu" says which one opened it
  // (Volgende wedstrijd, Belasting); otherwise it belongs to Planning.
  if (teamId && pathname.startsWith(`/teams/${teamId}/weeks`)) {
    const from = WEEK_PAGE_MENUS[search.get("menu") ?? ""] ?? WEEK_PAGE_MENUS.planning!;
    const item = NAV_ITEMS.find((i) => i.key === from.item)!;
    return { item, tab: item.tabs.find((t) => t.teamPath === from.teamPath) ?? item.tabs[0]! };
  }
  return null;
}
