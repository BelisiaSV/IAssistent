import Link from "next/link";
import type { ReactNode } from "react";

import { NavIcon } from "@/components/nav-icons";
import { RoleAvatar, staffColor } from "@/components/staff/role-avatar";
import { messages } from "@/lib/messages";
import { type NavGroup, sectionHref } from "@/lib/navigation";

const m = messages.staffPage;

export interface StaffRoleCard {
  group: NavGroup;
  name: string;
  status: "active" | "off" | "soon";
}

/** The hierarchy of the AI staff: head coach, coordinator, the roles, approval and publication. */
export function StaffHierarchy({ teamId, roles }: { teamId: string; roles: StaffRoleCard[] }) {

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <p className="text-center text-sm text-slate-600">{m.intro}</p>

      <Tier member="head-coach" title={m.headCoach} hint={m.headCoachHint} />
      <Arrow />
      <Tier member="coordinator" title={m.coordinator} hint={m.coordinatorHint} />
      <Arrow />

      <ul className="grid gap-3 sm:grid-cols-2">
        {roles.map(({ group, name, status }) => (
          <li key={group.member} className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <RoleAvatar member={group.member} size={52} muted={status === "soon"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-slate-900">{name}</p>
                <p className="truncate text-sm text-slate-500">{m.taglines[group.member]}</p>
              </div>
              <StatusPill status={status} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.sections.map((sec) => {
                const href = sectionHref(sec, teamId);
                const chip = (
                  <>
                    <NavIcon name={sec.icon} className="h-3.5 w-3.5" />
                    {sec.label}
                  </>
                );
                return href ? (
                  <Link
                    key={sec.label}
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                  >
                    {chip}
                  </Link>
                ) : (
                  <span key={sec.label} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-200">
                    {chip}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              disabled
              title={m.askSoon}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold opacity-60"
              style={{ backgroundColor: `color-mix(in srgb, ${staffColor(group.member)} 18%, transparent)`, color: staffColor(group.member) }}
            >
              {m.ask(name)}
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] tracking-wide uppercase">{messages.nav.soon}</span>
            </button>
          </li>
        ))}
      </ul>

      <Arrow />
      <Tier
        member="head-coach"
        title={m.approval}
        hint={m.approvalHint}
        action={
          <Link href={`/teams/${teamId}/weeks`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15">
            {m.approvalLink} →
          </Link>
        }
        plain
      />
    </div>
  );
}

function Tier({ member, title, hint, action, plain = false }: { member: string; title: string; hint: string; action?: ReactNode; plain?: boolean }) {
  return (
    <section
      className="flex flex-col items-center gap-2 rounded-2xl px-5 py-5 text-center ring-1 ring-slate-200"
      style={{ backgroundColor: plain ? undefined : `color-mix(in srgb, ${staffColor(member)} 10%, transparent)` }}
    >
      {!plain && <RoleAvatar member={member} size={56} />}
      <p className="text-lg font-extrabold tracking-wide text-slate-900 uppercase">{title}</p>
      <p className="text-sm text-slate-600">{hint}</p>
      {action}
    </section>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center text-slate-400" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 4v15M6 13l6 6 6-6" />
      </svg>
    </div>
  );
}

function StatusPill({ status }: { status: "active" | "off" | "soon" }) {
  const style = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    off: "bg-amber-50 text-amber-700 ring-amber-200",
    soon: "bg-slate-100 text-slate-500 ring-slate-200",
  }[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${style}`}>{m.status[status]}</span>;
}
