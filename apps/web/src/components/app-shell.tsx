"use client";

import { type ReactNode, useState } from "react";

import { SIDEBAR_COOKIE } from "@/lib/sidebar";

import { Sidebar } from "./sidebar";
import type { SwitcherTeam } from "./team-switcher";

/** Side bar and page; the page widens when the side bar is collapsed to its icons. */
export function AppShell({
  teams,
  admin,
  email,
  initialCollapsed,
  children,
}: {
  teams: SwitcherTeam[];
  admin: boolean;
  email: string;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={`min-h-screen transition-[padding] print:pl-0 ${collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"}`}>
      <Sidebar teams={teams} admin={admin} email={email} collapsed={collapsed} onToggle={toggle} />
      <main className="mx-auto max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
