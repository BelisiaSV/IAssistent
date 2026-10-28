"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { messages } from "@/lib/messages";

export interface SwitcherTeam {
  id: string;
  name: string;
  clubName: string;
  logoUrl: string | null;
  primaryColor: string;
  archived: boolean;
}

const m = messages.nav;

/**
 * Pick the team at the top of every page. On a team page the other team
 * opens on the same tab (players, weeks, …); elsewhere on its dashboard.
 */
export function TeamSwitcher({ teams }: { teams: SwitcherTeam[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const match = /^\/teams\/([0-9a-f-]{36})(\/[^/]+)?/.exec(pathname);
  const current = teams.find((t) => t.id === match?.[1]) ?? null;
  const tab = match?.[2] ?? "";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const active = teams.filter((t) => !t.archived);
  const archived = teams.filter((t) => t.archived);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex max-w-[16rem] items-center gap-2 rounded-lg border border-white/15 bg-white/10 py-1.5 pr-2.5 pl-1.5 text-sm font-medium text-white hover:bg-white/15"
      >
        {current ? <Crest team={current} /> : <span className="h-7 w-7 rounded-md bg-white/15" />}
        <span className="min-w-0 truncate">{current ? `${current.clubName} · ${current.name}` : m.chooseTeam}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 opacity-70" aria-hidden>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-30 mt-2 w-72 overflow-hidden rounded-xl bg-white text-slate-800 shadow-xl ring-1 ring-slate-200">
          <ul className="max-h-80 overflow-y-auto py-1">
            {[...active, ...archived].map((t) => (
              <li key={t.id}>
                <Link
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  href={`/teams/${t.id}${tab}`}
                  className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 ${t.archived ? "opacity-60" : ""} ${t.id === current?.id ? "bg-slate-50 font-semibold" : ""}`}
                >
                  <Crest team={t} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t.clubName}</span>
                    <span className="block truncate text-xs text-slate-500">{t.name}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-slate-100 px-3 py-2 text-sm">
            <Link href="/teams" onClick={() => setOpen(false)} className="text-slate-600 hover:text-brand">
              {m.allTeams}
            </Link>
            <Link href="/teams/new" onClick={() => setOpen(false)} className="font-medium text-brand hover:text-brand-dark">
              + {m.newTeam}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Crest({ team }: { team: SwitcherTeam }) {
  if (team.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md bg-white object-contain p-0.5" />;
  }
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: team.primaryColor }}>
      {team.clubName.slice(0, 1).toUpperCase()}
    </span>
  );
}
