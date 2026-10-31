"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { messages } from "@/lib/messages";

import { NavIcon, type NavIconName } from "./nav-icons";
import { type SwitcherTeam, TeamCrest, TeamSwitcher } from "./team-switcher";

const m = messages.nav;
const LAST_TEAM_KEY = "iassistent.team";

interface NavItem {
  label: string;
  icon: NavIconName;
  /** Path under the team (null = not built yet), or an absolute path. */
  teamPath?: string | null;
  href?: string;
  exact?: boolean;
}

/** Every item of the side bar; shown in alphabetical order of their labels. */
const ITEMS: NavItem[] = (
  [
  { label: m.animations, icon: "animations", teamPath: null },
  { label: m.dashboard, icon: "dashboard", teamPath: "", exact: true },
  { label: m.editor, icon: "editor", teamPath: null },
  { label: m.settings, icon: "settings", teamPath: "/settings" },
  { label: m.matchday, icon: "matchday", teamPath: "/lineups" },
  { label: m.microcycle, icon: "microcycle", teamPath: "/weeks" },
  { label: m.exercises, icon: "exercises", href: "/exercises" },
  { label: m.players, icon: "players", teamPath: "/players" },
  { label: m.opponents, icon: "opponents", teamPath: "/opponents" },
  { label: m.tests, icon: "tests", teamPath: "/tests" },
  { label: m.videos, icon: "videos", teamPath: null },
    { label: m.vision, icon: "vision", href: "/profile/vision" },
  ] satisfies NavItem[]
).sort((a, b) => a.label.localeCompare(b.label, "nl"));

function readLastTeam() {
  try {
    return localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};

/**
 * The side bar of the platform: team switcher, the sections in alphabetical
 * order (team sections open for the current team, or the last one used) and
 * the account. On small screens it opens as a drawer from the top bar.
 */
export function Sidebar({
  teams,
  admin,
  email,
  collapsed,
  onToggle,
}: {
  teams: SwitcherTeam[];
  admin: boolean;
  email: string;
  /** Large screens: only the icons. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const routeTeam = /^\/teams\/([0-9a-f-]{36})/.exec(pathname)?.[1] ?? null;
  const lastTeam = useSyncExternalStore(noSubscribe, readLastTeam, () => null);
  const teamId =
    [routeTeam, lastTeam].find((id) => id && teams.some((t) => t.id === id)) ?? teams.find((t) => !t.archived)?.id ?? teams[0]?.id ?? null;

  useEffect(() => {
    if (!routeTeam) return;
    try {
      localStorage.setItem(LAST_TEAM_KEY, routeTeam);
    } catch {
      // Storage blocked: the side bar falls back to the first team.
    }
  }, [routeTeam]);

  const current = teams.find((t) => t.id === teamId) ?? null;

  const nav = (compact: boolean) => (
    <nav className={`flex h-full flex-col gap-4 overflow-y-auto py-4 ${compact ? "items-center px-2" : "px-3"}`}>
      <Link
        href="/teams"
        title={compact ? messages.app.name : undefined}
        className={`flex items-center gap-2.5 text-lg font-bold tracking-tight text-white ${compact ? "" : "px-2"}`}
        onClick={() => setOpen(false)}
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-900">
          IA
        </span>
        {!compact && messages.app.name}
      </Link>

      {compact ? (
        <button type="button" onClick={onToggle} title={current ? `${current.clubName} · ${current.name}` : m.chooseTeam} className="rounded-xl p-1 hover:bg-white/10">
          <TeamCrest team={current} />
        </button>
      ) : (
        <TeamSwitcher teams={teams} currentId={teamId} />
      )}

      <ul className={`space-y-0.5 ${compact ? "w-full" : ""}`}>
        {ITEMS.map((item) => {
          const href = item.href ?? (item.teamPath === null || !teamId ? null : `/teams/${teamId}${item.teamPath}`);
          const title = compact ? (item.teamPath === null ? `${item.label} · ${m.soon}` : item.label) : undefined;
          const layout = compact ? "justify-center px-0" : "gap-3 px-3";
          if (!href) {
            return (
              <li key={item.label}>
                <span title={title} className={`flex cursor-default items-center rounded-lg py-2 text-sm text-slate-500 ${layout}`}>
                  <NavIcon name={item.icon} />
                  {!compact && <span className="flex-1">{item.label}</span>}
                  {!compact && item.teamPath === null && (
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {m.soon}
                    </span>
                  )}
                </span>
              </li>
            );
          }
          const active = item.exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={item.label}>
              <Link
                href={href}
                title={title}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center rounded-lg py-2 text-sm font-medium transition ${layout} ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full" style={{ backgroundColor: current?.primaryColor ?? "#ffffff" }} />
                )}
                <NavIcon name={item.icon} />
                {!compact && item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={`mt-auto space-y-1 border-t border-white/10 pt-3 ${compact ? "flex w-full flex-col items-center" : ""}`}>
        {admin && (
          <Link
            href="/admin/players"
            title={compact ? messages.playerImport.nav : undefined}
            onClick={() => setOpen(false)}
            className={`flex items-center rounded-lg py-2 text-sm font-medium ${compact ? "w-full justify-center" : "gap-3 px-3"} ${
              pathname.startsWith("/admin") ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <NavIcon name="admin" />
            {!compact && messages.playerImport.nav}
          </Link>
        )}
        <div className={`flex items-center rounded-lg py-2 ${compact ? "justify-center" : "gap-3 px-3"}`} title={compact ? email : undefined}>
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            {email.slice(0, 1).toUpperCase()}
          </span>
          {!compact && <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{email}</span>}
        </div>
        <form action="/auth/signout" method="post" className={compact ? "w-full" : ""}>
          <button
            type="submit"
            title={compact ? m.signOut : undefined}
            className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-300 ring-1 ring-white/10 hover:bg-white/5 hover:text-white ${
              compact ? "justify-center" : "gap-3 px-3 text-left"
            }`}
          >
            <NavIcon name="logout" />
            {!compact && m.signOut}
          </button>
        </form>
        <button
          type="button"
          onClick={onToggle}
          title={compact ? m.expand : m.collapse}
          aria-label={compact ? m.expand : m.collapse}
          className={`hidden w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white lg:flex ${
            compact ? "justify-center" : "gap-3 px-3"
          }`}
        >
          <NavIcon name={compact ? "expand" : "collapse"} />
          {!compact && m.collapse}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Small screens: top bar with the menu button. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-2.5 text-white lg:hidden print:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label={m.menu} className="rounded-md p-1.5 hover:bg-white/10">
          <NavIcon name="menu" className="h-6 w-6" />
        </button>
        <span className="min-w-0 truncate text-sm font-semibold">{current ? `${current.clubName} · ${current.name}` : messages.app.name}</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <button type="button" aria-label={m.closeMenu} className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label={m.closeMenu} className="absolute top-4 right-3 rounded-md p-1 text-slate-300 hover:bg-white/10">
              <NavIcon name="close" />
            </button>
            {nav(false)}
          </aside>
        </div>
      )}
      {/* Large screens: fixed side bar. */}
      <aside className={`fixed inset-y-0 left-0 z-20 hidden bg-slate-900 transition-[width] lg:block print:hidden ${collapsed ? "w-[4.5rem]" : "w-64"}`}>
        {nav(collapsed)}
      </aside>
    </>
  );
}
