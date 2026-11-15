"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NavIcon } from "@/components/nav-icons";
import { useCurrentTeam } from "@/components/use-current-team";
import { messages } from "@/lib/messages";
import { STAFF_ROOM_ROLES } from "@/lib/staff-room/roles";

import { ChatThread } from "./chat-thread";
import { RoleAvatar } from "./role-avatar";

const m = messages.staffRoom;

/**
 * The staff, always at hand: a column of avatars on the right of every page.
 * A click opens the conversation with that role over the page, for the
 * current team (or the last one used). Not shown in the Staff Room itself.
 */
export function StaffDock({
  teams,
  roleNames,
  testMode,
}: {
  teams: readonly { id: string; archived: boolean }[];
  roleNames: Record<string, string>;
  testMode: boolean;
}) {
  const pathname = usePathname();
  const teamId = useCurrentTeam(teams);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!role) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setRole(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role]);

  if (!teamId || pathname.includes("/print") || pathname.endsWith("/staff-room")) return null;

  const open = (id: string) => {
    setRole(id);
    setMobileOpen(false);
  };
  const avatars = STAFF_ROOM_ROLES.map((id) => (
    <li key={id}>
      <button
        type="button"
        onClick={() => open(id)}
        title={m.openChat(roleNames[id] ?? id)}
        aria-label={m.openChat(roleNames[id] ?? id)}
        className={`block rounded-full p-0.5 transition hover:scale-110 hover:bg-white/10 ${role === id ? "bg-white/15" : ""}`}
      >
        <RoleAvatar member={id} size={36} />
      </button>
    </li>
  ));

  return (
    <>
      {/* Large screens: the column on the right edge. */}
      <aside aria-label={m.dock} className="fixed top-1/2 right-3 z-30 hidden -translate-y-1/2 lg:block print:hidden">
        <ul className="flex flex-col gap-1.5 rounded-full bg-slate-900/90 p-1.5 shadow-xl ring-1 ring-white/10 backdrop-blur">{avatars}</ul>
      </aside>

      {/* Small screens: one button that unfolds the staff. */}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-2 lg:hidden print:hidden">
        {mobileOpen && <ul className="flex flex-col gap-1.5 rounded-3xl bg-slate-900/95 p-1.5 shadow-xl ring-1 ring-white/10">{avatars}</ul>}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label={m.dock}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-1 ring-white/15"
        >
          <NavIcon name={mobileOpen ? "close" : "chat"} className="h-6 w-6" />
        </button>
      </div>

      {role && (
        <div className="app-dark fixed inset-0 z-50 print:hidden">
          <button type="button" aria-label={m.close} className="absolute inset-0 bg-black/50" onClick={() => setRole(null)} />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={roleNames[role] ?? role}
            className="absolute inset-y-0 right-0 flex w-full flex-col bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 sm:w-[440px]"
          >
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <RoleAvatar member={role} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{roleNames[role] ?? role}</p>
                <p className="truncate text-xs text-slate-500">{m.taglines[role]}</p>
              </div>
              {testMode && (
                <span title={m.testModeHint} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {m.testMode}
                </span>
              )}
              <button type="button" onClick={() => setRole(null)} aria-label={m.close} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <NavIcon name="close" />
              </button>
            </header>
            <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
              {STAFF_ROOM_ROLES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  title={roleNames[id] ?? id}
                  aria-label={m.openChat(roleNames[id] ?? id)}
                  aria-pressed={id === role}
                  className={`shrink-0 rounded-full p-0.5 ${id === role ? "ring-2 ring-brand" : "opacity-60 hover:opacity-100"}`}
                >
                  <RoleAvatar member={id} size={26} />
                </button>
              ))}
            </nav>
            <ChatThread key={`${teamId}:${role}`} teamId={teamId} role={role} roleNames={roleNames} className="flex-1" />
            <Link
              href={`/teams/${teamId}/staff-room?rol=${role}`}
              onClick={() => setRole(null)}
              className="border-t border-slate-200 px-4 py-2.5 text-center text-sm font-medium text-brand hover:underline"
            >
              {m.openRoom} →
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
