"use client";

import type { TaskProposal } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { confirmTask } from "@/lib/staff-room/task-actions";
import { progressStep, type TaskStatus } from "@/lib/staff-room/tasks";

import { RoleAvatar } from "./role-avatar";
import { TaskProgress } from "./task-progress";
import { useTaskRunner } from "./use-task-runner";

const m = messages.staffRoom;
const t = messages.tasksPage;

/**
 * A joint task a role proposes: title, the roles involved and the assignment.
 * The head coach confirms it here; then the card follows the staff at work
 * and links to the task.
 */
export function TaskProposalCard({
  task,
  roleNames,
  owner,
  showOwner = false,
  messageId,
  teamId,
  confirmed,
  canWrite,
}: {
  task: TaskProposal;
  roleNames: Record<string, string>;
  /** Role that proposed it; it makes the final proposal. */
  owner: string;
  /** Say who proposed it (on the task lists). */
  showOwner?: boolean;
  /** The message with the proposal. */
  messageId: string;
  teamId: string;
  /** The task, once the head coach confirmed it. */
  confirmed: { id: string; status: TaskStatus } | null;
  canWrite: boolean;
}) {
  const runner = useTaskRunner(confirmed);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = runner.status;
  const working = status === "running" ? runner.task?.steps.find((s) => s.status !== "ready") : undefined;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmTask(messageId);
      if (result.task) runner.update(result.task);
      if (result.error) setError(result.error);
    });
  }

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
        {status && <StatusBadge status={status} />}
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

      <div className="mt-3 space-y-2">
        <TaskProgress step={progressStep(status)} />
        {working && (
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <RoleAvatar member={working.role} size={18} />
            <span className="animate-pulse">{t.working(roleNames[working.role] ?? working.role)}</span>
          </p>
        )}
        {!status && canWrite && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {pending ? m.confirming : m.confirm}
            </button>
            <span className="text-xs text-slate-500">{m.confirmHint}</span>
          </div>
        )}
        {runner.id && (
          <Link href={`/teams/${teamId}/tasks/${runner.id}`} className="inline-block text-xs font-medium text-brand hover:underline">
            {t.view} →
          </Link>
        )}
        {(error ?? runner.error) && <p className="text-xs text-red-700">{error ?? runner.error}</p>}
      </div>
    </div>
  );
}

const BADGE: Record<TaskStatus, string> = {
  running: "bg-blue-100 text-blue-800",
  ready: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  approved: "bg-green-100 text-green-800",
};

export function StatusBadge({ status }: { status: TaskStatus | "proposed" }) {
  const cls = status === "proposed" ? "bg-slate-100 text-slate-600" : BADGE[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{t.status[status]}</span>;
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6.5l1.5 1.5L8.5 5M4 12.5l1.5 1.5 3-3M11.5 6.5H20M11.5 12.5H20M4 18.5h16" />
    </svg>
  );
}
