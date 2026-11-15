import type { TaskProposal } from "@iassistent/staff-engine/content";

import { messages } from "@/lib/messages";

import { RoleAvatar } from "./role-avatar";

const m = messages.staffRoom;

/** A joint task a role proposes: title, the roles involved and the assignment. */
export function TaskProposalCard({
  task,
  roleNames,
  owner,
  showOwner = false,
}: {
  task: TaskProposal;
  roleNames: Record<string, string>;
  /** Role that proposed it; it works on the task too. */
  owner: string;
  /** Say who proposed it (on the task lists). */
  showOwner?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3.5 text-left ring-1 ring-slate-200">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-slate-400">
          <TaskIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{task.titel}</p>
          {showOwner && <p className="text-xs text-slate-500">{m.proposedBy(roleNames[owner] ?? owner)}</p>}
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{task.opdracht}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">{m.involved}:</span>
        {[owner, ...task.betrokken_rollen.filter((id) => id !== owner)].map((id) => (
          <span key={id} className="flex items-center gap-1.5 rounded-full bg-slate-50 py-0.5 pr-2.5 pl-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
            <RoleAvatar member={id} size={20} />
            {roleNames[id] ?? id}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" disabled className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white opacity-50">
          {m.confirm}
        </button>
        <span className="text-xs text-slate-500">{m.confirmSoon}</span>
      </div>
    </div>
  );
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6.5l1.5 1.5L8.5 5M4 12.5l1.5 1.5 3-3M11.5 6.5H20M11.5 12.5H20M4 18.5h16" />
    </svg>
  );
}
