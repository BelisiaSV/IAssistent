"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

/** Tabs of a team, on the team banner (text colour inherits from the banner). */
export function TeamTabs({ teamId, accent }: { teamId: string; accent: string }) {
  const pathname = usePathname();
  const base = `/teams/${teamId}`;
  const tabs = [
    { href: base, label: messages.teamNav.dashboard, exact: true },
    { href: `${base}/players`, label: messages.teamNav.players },
    { href: `${base}/lineups`, label: messages.teamNav.lineups },
    { href: `${base}/weeks`, label: messages.teamNav.weeks },
    { href: `${base}/opponents`, label: messages.teamNav.opponents },
    { href: `${base}/tests`, label: messages.teamNav.tests },
    { href: `${base}/settings`, label: messages.teamNav.settings },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto bg-black/15 px-3 sm:px-4">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition-opacity ${active ? "opacity-100" : "opacity-70 hover:opacity-100"}`}
          >
            {tab.label}
            {active && <span className="absolute inset-x-2 bottom-0 h-1 rounded-t-full" style={{ backgroundColor: accent }} />}
          </Link>
        );
      })}
    </nav>
  );
}
