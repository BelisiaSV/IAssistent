"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  // Print pages stay light (paper); the dashboard has its own dark style.
  const print = pathname.includes("/print");
  const dashboard = /^\/teams\/[0-9a-f-]{36}$/.test(pathname);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={`min-h-screen transition-[padding] print:pl-0 ${collapsed ? "lg:pl-[4.5rem]" : "lg:pl-64"} ${print ? "" : "bg-[#0b1220]"}`}>
      <Sidebar teams={teams} admin={admin} email={email} collapsed={collapsed} onToggle={toggle} />
      <main
        className={`mx-auto max-w-[1760px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:max-w-none print:p-0 ${
          print || dashboard ? "" : "app-dark min-h-screen text-slate-900"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
