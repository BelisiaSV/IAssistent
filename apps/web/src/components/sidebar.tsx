"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { messages } from "@/lib/messages";
import { isActive, NAV_GROUPS, type NavGroup, sectionHref } from "@/lib/navigation";

import { RoleAvatar, staffColor } from "./staff/role-avatar";

import { NavIcon } from "./nav-icons";
import { type SwitcherTeam, TeamCrest, TeamSwitcher } from "./team-switcher";

const m = messages.nav;
const LAST_TEAM_KEY = "iassistent.team";

function readLastTeam() {
  try {
    return localStorage.getItem(LAST_TEAM_KEY);
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};

/**
 * The side bar of the platform: team switcher, then the staff (head coach
 * on top, then every role) with the parts each one is responsible for in a
 * fold-out list (team parts open for the current team, or the last one used),
 * and the account. On small screens it opens as a drawer from the top bar;
 * collapsed, it shows the staff as avatars.
 */
export function Sidebar({
  teams,
  admin,
  email,
  roleNames,
  collapsed,
  onToggle,
}: {
  teams: SwitcherTeam[];
  admin: boolean;
  email: string;
  /** Name of each staff role (from /staff). */
  roleNames: Record<string, string>;
  /** Large screens: only the icons. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  // Groups the user opened or closed; the others follow the current page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
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
  const groupName = (group: NavGroup) => (group.member === "head-coach" ? m.headCoach : (roleNames[group.member] ?? group.member));

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

      <div className={`space-y-1 ${compact ? "flex w-full flex-col items-center" : ""}`}>
        {NAV_GROUPS.map((group) => {
          const name = groupName(group);
          const containsActive = group.sections.some((sec) => {
            const href = sectionHref(sec, teamId);
            return href && isActive(sec, href, pathname, search, group.sections);
          });
          if (compact) {
            return (
              <button
                key={group.member}
                type="button"
                title={name}
                aria-label={name}
                onClick={() => {
                  setToggled((t) => ({ ...t, [group.member]: true }));
                  onToggle();
                }}
                className={`rounded-full p-1 transition hover:bg-white/10 ${containsActive ? "bg-white/10" : ""}`}
              >
                <RoleAvatar member={group.member} size={30} />
              </button>
            );
          }
          const expanded = toggled[group.member] ?? (containsActive || group.member === "head-coach");
          return (
            <div key={group.member}>
              <button
                type="button"
                onClick={() => setToggled((t) => ({ ...t, [group.member]: !expanded }))}
                aria-expanded={expanded}
                aria-label={m.toggleGroup(name)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition hover:bg-white/5 ${
                  containsActive ? "text-white" : "text-slate-300"
                }`}
              >
                <RoleAvatar member={group.member} size={26} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <NavIcon name="chevron" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
              {expanded && (
                <ul className="mt-0.5 mb-1.5 ml-[1.15rem] space-y-0.5 border-l border-white/10 pl-2.5">
                  {group.sections.map((sec) => {
                    const href = sectionHref(sec, teamId);
                    if (!href) {
                      return (
                        <li key={sec.label}>
                          <span className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-500">
                            <NavIcon name={sec.icon} className="h-4 w-4" />
                            <span className="flex-1 truncate">{sec.label}</span>
                            {sec.teamPath === null && (
                              <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
                                {m.soon}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    }
                    const active = isActive(sec, href, pathname, search, group.sections);
                    return (
                      <li key={sec.label}>
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                            active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {active && (
                            <span className="absolute inset-y-1.5 -left-[11px] w-[3px] rounded-full" style={{ backgroundColor: staffColor(group.member) }} />
                          )}
                          <NavIcon name={sec.icon} className="h-4 w-4" />
                          <span className="truncate">{sec.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

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
        <Link
          href="/account"
          onClick={() => setOpen(false)}
          title={compact ? `${email} · ${messages.plans.account.title}` : undefined}
          className={`flex items-center rounded-lg py-2 hover:bg-white/5 ${pathname.startsWith("/account") ? "bg-white/10" : ""} ${compact ? "w-full justify-center" : "gap-3 px-3"}`}
        >
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            {email.slice(0, 1).toUpperCase()}
          </span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-300">{email}</span>
              <span className="block text-[11px] text-slate-500">{messages.plans.account.title}</span>
            </span>
          )}
        </Link>
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
