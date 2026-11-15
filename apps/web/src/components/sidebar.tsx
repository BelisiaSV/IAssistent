"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { messages } from "@/lib/messages";
import { activeNav, NAV_ITEMS, tabHref } from "@/lib/navigation";

import { NavIcon } from "./nav-icons";
import { type SwitcherTeam, TeamCrest, TeamSwitcher } from "./team-switcher";
import { useCurrentTeam } from "./use-current-team";

const m = messages.nav;

/**
 * The side bar of the platform: team switcher, the menus of the head coach
 * (team menus open for the current team, or the last one used) and the
 * account. The parts of a menu are tabs on the page itself. On small screens
 * it opens as a drawer from the top bar; collapsed, it shows only the icons.
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
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const teamId = useCurrentTeam(teams);
  const current = teams.find((t) => t.id === teamId) ?? null;
  const active = activeNav(pathname, search, teamId);

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

      <ul className={`space-y-1 ${compact ? "flex w-full flex-col items-center" : ""}`}>
        {NAV_ITEMS.map((item) => {
          const href = tabHref(item.tabs[0]!, teamId);
          const isCurrent = active?.item.key === item.key;
          const cls = `flex items-center rounded-lg py-2 text-sm font-medium transition ${compact ? "justify-center px-2.5" : "gap-3 px-3"}`;
          return (
            <li key={item.key} className={compact ? "w-full" : ""}>
              {href ? (
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  title={compact ? item.label : undefined}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`${cls} ${isCurrent ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <NavIcon name={item.icon} />
                  {!compact && item.label}
                </Link>
              ) : (
                <span title={compact ? item.label : undefined} className={`${cls} cursor-default text-slate-500`}>
                  <NavIcon name={item.icon} />
                  {!compact && item.label}
                </span>
              )}
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
