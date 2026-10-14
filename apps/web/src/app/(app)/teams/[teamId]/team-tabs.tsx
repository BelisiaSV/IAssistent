"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

export function TeamTabs({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/teams/${teamId}/players`, label: messages.teamNav.players },
    { href: `/teams/${teamId}/lineups`, label: messages.teamNav.lineups },
    { href: `/teams/${teamId}/weeks`, label: messages.teamNav.weeks },
    { href: `/teams/${teamId}/opponents`, label: messages.teamNav.opponents },
    { href: `/teams/${teamId}/settings`, label: messages.teamNav.settings },
    { href: `/teams/${teamId}/tests`, label: messages.teamNav.tests },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-brand text-brand" : "border-transparent text-slate-600 hover:text-brand"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
