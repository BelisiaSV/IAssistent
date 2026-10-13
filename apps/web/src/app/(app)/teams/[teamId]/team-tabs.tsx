"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

export function TeamTabs({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/teams/${teamId}/players`, label: messages.teamNav.players },
    { href: `/teams/${teamId}/lineups`, label: messages.teamNav.lineups },
  ];
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
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
