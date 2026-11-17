"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

const TABS = [
  { href: "/admin/players", label: messages.plans.adminTabs.players },
  { href: "/admin/plans", label: messages.plans.adminTabs.plans },
  { href: "/admin/accounts", label: messages.plans.adminTabs.accounts },
  { href: "/admin/competition", label: messages.plans.adminTabs.competition },
  { href: "/admin/exercise-bank", label: messages.plans.adminTabs.exerciseBank },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${active ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
