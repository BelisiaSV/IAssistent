"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { messages } from "@/lib/messages";

const t = messages.club.tabs;

export function ClubTabs({
  clubId,
  manage,
  dna,
  exercises,
  planning,
  evaluations,
}: {
  clubId: string;
  manage: boolean;
  /** The club has the Club DNA module. */
  dna: boolean;
  /** The club has the shared exercise library. */
  exercises: boolean;
  /** The club has the club planning. */
  planning: boolean;
  /** The club has evaluations and development. */
  evaluations: boolean;
}) {
  const pathname = usePathname();
  const base = `/clubs/${clubId}`;
  const tabs = [
    { href: base, label: t.dashboard, exact: true },
    { href: `${base}/structure`, label: t.structure, exact: false },
    ...(planning ? [{ href: `${base}/planning`, label: t.planning, exact: false }] : []),
    ...(evaluations ? [{ href: `${base}/evaluations`, label: t.evaluations, exact: false }] : []),
    ...(dna ? [{ href: `${base}/dna`, label: t.dna, exact: false }] : []),
    ...(exercises ? [{ href: `${base}/exercises`, label: t.exercises, exact: false }] : []),
    ...(manage
      ? [{ href: `${base}/licenses`, label: t.licenses, exact: false }]
      : []),
  ];
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
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
