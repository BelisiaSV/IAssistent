"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { addCoachTask, askCoachTask, removeCoachTask, setCoachTaskDone } from "@/lib/staff-room/coach-task-actions";

import { RoleAvatar } from "./role-avatar";

const m = messages.tasksPage.mine;

export interface CoachTask {
  id: string;
  title: string;
  done: boolean;
  role: string | null;
  askedAt: string | null;
  /** The role the task would go to by default (taakroutering.json). */
  suggested: string;
}

/** The to-dos of the head coach: add, tick off, or ask the staff. */
export function CoachTaskList({
  teamId,
  tasks,
  roles,
  roleNames,
  canWrite,
}: {
  teamId: string;
  tasks: CoachTask[];
  roles: string[];
  roleNames: Record<string, string>;
  canWrite: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = tasks.filter((t) => !t.done);
  const finished = tasks.filter((t) => t.done);

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="text-lg font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      {canWrite && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) run(() => addCoachTask(teamId, text), () => setText(""));
          }}
        >
          <input
            value={text}
            maxLength={300}
            onChange={(event) => setText(event.target.value)}
            placeholder={m.placeholder}
            aria-label={m.placeholder}
            className="min-w-64 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button disabled={pending || !text.trim()} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            {m.add}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!tasks.length ? (
        <p className="text-sm text-slate-500">{m.empty}</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-200">
            {open.map((task) => (
              <TaskRow key={task.id} task={task} teamId={teamId} roles={roles} roleNames={roleNames} canWrite={canWrite} pending={pending} run={run} />
            ))}
          </ul>
          {finished.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-600">{m.doneTitle(finished.length)}</summary>
              <ul className="mt-2 divide-y divide-slate-200">
                {finished.map((task) => (
                  <TaskRow key={task.id} task={task} teamId={teamId} roles={roles} roleNames={roleNames} canWrite={canWrite} pending={pending} run={run} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function TaskRow({
  task,
  teamId,
  roles,
  roleNames,
  canWrite,
  pending,
  run,
}: {
  task: CoachTask;
  teamId: string;
  roles: string[];
  roleNames: Record<string, string>;
  canWrite: boolean;
  pending: boolean;
  run: (action: () => Promise<{ error?: string }>) => void;
}) {
  const [role, setRole] = useState(task.role ?? task.suggested);
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={task.done}
        disabled={!canWrite || pending}
        aria-label={m.done}
        onChange={(event) => run(() => setCoachTaskDone(teamId, task.id, event.target.checked))}
        className="h-4 w-4 accent-brand"
      />
      <span className={`min-w-48 flex-1 text-sm ${task.done ? "text-slate-400 line-through" : ""}`}>{task.title}</span>
      {task.askedAt && task.role && (
        <span className="flex items-center gap-2 text-xs text-slate-600">
          <RoleAvatar member={task.role} size={20} />
          {m.asked(roleNames[task.role] ?? task.role)} ·
          <Link href={`/teams/${teamId}/staff-room?rol=${task.role}`} className="font-medium text-brand hover:underline">
            {m.answer}
          </Link>
        </span>
      )}
      {canWrite && !task.done && (
        <span className="flex items-center gap-2">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-label={m.role}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleNames[r] ?? r}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => askCoachTask(teamId, task.id, role))}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {pending ? m.asking : m.ask}
          </button>
        </span>
      )}
      {canWrite && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeCoachTask(teamId, task.id))}
          aria-label={m.remove}
          title={m.remove}
          className="rounded px-1.5 text-lg leading-none text-slate-400 hover:text-red-600 disabled:opacity-50"
        >
          ×
        </button>
      )}
    </li>
  );
}
