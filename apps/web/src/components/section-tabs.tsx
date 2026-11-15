"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { messages } from "@/lib/messages";
import { activeNav, isTabActive, tabHref } from "@/lib/navigation";

import { RoleAvatar, staffColor } from "./staff/role-avatar";

/**
 * The parts of the current menu as tabs, each with the role that takes care
 * of it. Hidden for menus with a single part.
 */
export function SectionTabs({ teamId, roleNames }: { teamId: string | null; roleNames: Record<string, string> }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = activeNav(pathname, search, teamId);
  if (!active || active.item.tabs.length < 2) return null;
  const { item } = active;

  return (
    <nav aria-label={messages.nav.sectionsOf(item.label)} className="mb-6 print:hidden">
      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{item.label}</p>
      <ul className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {item.tabs.map((tab) => {
          const href = tabHref(tab, teamId);
          const current = tab === active.tab || (!!href && isTabActive(tab, href, pathname, search, item.tabs));
          const role = tab.member ? roleNames[tab.member] : undefined;
          const content = (
            <>
              {tab.member && <RoleAvatar member={tab.member} size={20} muted={!current} />}
              <span>{tab.label}</span>
            </>
          );
          const cls = "relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap";
          return (
            <li key={tab.label}>
              {href ? (
                <Link
                  href={href}
                  title={role ? messages.nav.byRole(role) : undefined}
                  aria-current={current ? "page" : undefined}
                  className={`${cls} ${current ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {content}
                  {current && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: tab.member ? staffColor(tab.member) : "#f5b700" }} />
                  )}
                </Link>
              ) : (
                <span className={`${cls} text-slate-400`}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
