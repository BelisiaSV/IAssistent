"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { SIDEBAR_COOKIE } from "@/lib/sidebar";

import { EnvironmentBar } from "./environment-bar";
import { SectionTabs } from "./section-tabs";
import { Sidebar } from "./sidebar";
import { StaffDock } from "./staff/staff-dock";
import type { SwitcherTeam } from "./team-switcher";
import { useCurrentTeam } from "./use-current-team";

/**
 * Side bar, the tabs of the current menu, the page and the staff on the right.
 * The page widens when the side bar is collapsed to its icons.
 */
export function AppShell({
  teams,
  clubs,
  admin,
  email,
  roleNames,
  initialCollapsed,
  testMode,
  children,
}: {
  teams: SwitcherTeam[];
  /** Clubs the user is a member of (club environment). */
  clubs: { id: string; name: string }[];
  admin: boolean;
  email: string;
  roleNames: Record<string, string>;
  initialCollapsed: boolean;
  /** The staff answers with examples from /staff (no AI). */
  testMode: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const pathname = usePathname();
  // Print pages stay light (paper); the dashboard has its own dark style.
  const print = pathname.includes("/print");
  const dashboard = /^\/teams\/[0-9a-f-]{36}$/.test(pathname);
  const teamId = useCurrentTeam(teams);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={`min-h-screen transition-[padding] print:pl-0 ${collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"} ${print ? "" : "bg-[#0b1220]"}`}>
      <Sidebar teams={teams} clubs={clubs} admin={admin} email={email} collapsed={collapsed} onToggle={toggle} />
      <main
        className={`mx-auto max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8 lg:pr-24 lg:pl-8 print:max-w-none print:p-0 ${
          print || dashboard ? "" : "app-dark min-h-screen text-slate-900"
        }`}
      >
        {!print && <EnvironmentBar teams={teams} />}
        {!print && <SectionTabs teamId={teamId} roleNames={roleNames} />}
        {children}
      </main>
      <StaffDock teams={teams} roleNames={roleNames} testMode={testMode} />
    </div>
  );
}
