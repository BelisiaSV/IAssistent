"use client";

import type { CollaborationOutput } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { useState, useTransition } from "react";

import { RoleAvatar } from "@/components/staff/role-avatar";
import { TaskProgress } from "@/components/staff/task-progress";
import { StatusBadge } from "@/components/staff/task-proposal-card";
import { useTaskRunner } from "@/components/staff/use-task-runner";
import { messages } from "@/lib/messages";
import { adjustTask, approveTask, retryTask, type TaskResult } from "@/lib/staff-room/task-actions";
import { finalProposal, progressStep, type TaskView } from "@/lib/staff-room/tasks";
import { longDate } from "@/lib/weeks/dates";

const m = messages.tasksPage;

/**
 * A joint task: the assignment, who works on what, the proposal for the head
 * coach (approve or ask for an adjustment) and the contributions of the staff.
 */
export function TaskDetail({ initial, roleNames, canWrite }: { initial: TaskView; roleNames: Record<string, string>; canWrite: boolean }) {
  const runner = useTaskRunner({ id: initial.id, status: initial.status, view: initial });
  const task = runner.task ?? initial;
  const status = runner.status ?? task.status;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const name = (id: string) => roleNames[id] ?? id;
  const final = finalProposal(task);
  const contributions = task.steps.filter((s) => s.phase === "bijdrage");

  function act(action: () => Promise<TaskResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.task) runner.update(result.task);
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  return (
    <div className="space-y-5">
      <Link href={`/teams/${task.teamId}/tasks`} className="text-sm font-medium text-brand hover:underline">
        ← {m.back}
      </Link>

      <header className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start gap-3">
          <RoleAvatar member={task.ownerRole} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">
              {messages.staffRoom.proposedBy(name(task.ownerRole))} · {m.version(task.version)}
            </p>
            <h1 className="text-xl font-bold tracking-tight">{task.title}</h1>
          </div>
          <StatusBadge status={status} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">{m.assignment}</p>
          <p className="text-sm whitespace-pre-line text-slate-700">{task.assignment}</p>
        </div>
        {task.feedback && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
            <p className="text-xs font-semibold text-amber-800">{m.feedback}</p>
            <p className="text-sm whitespace-pre-line text-slate-700">{task.feedback}</p>
          </div>
        )}
        <TaskProgress step={progressStep(status)} />
      </header>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.steps}</h2>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {task.steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <RoleAvatar member={step.role} size={34} muted={step.status === "pending"} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name(step.role)}</p>
                <p className="text-xs text-slate-500">
                  {m.phase[step.phase]} ·{" "}
                  <span className={step.status === "generating" ? "animate-pulse" : step.status === "failed" ? "text-red-700" : ""}>
                    {m.stepStatus[step.status]}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {status === "failed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <p className="flex-1 text-sm text-red-700">{m.failedHint}</p>
          {canWrite && (
            <button type="button" disabled={pending} onClick={() => act(() => retryTask(task.id))} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {m.retry}
            </button>
          )}
        </div>
      )}

      {final && (
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-2 ring-brand/40">
          <div className="flex items-center gap-3">
            <RoleAvatar member={task.ownerRole} size={36} />
            <h2 className="text-lg font-semibold">{m.proposal}</h2>
          </div>
          <Output output={final} />
          {status === "approved" && task.decidedAt && <p className="text-sm font-medium text-green-700">{m.approved(longDate(task.decidedAt.slice(0, 10)))}</p>}
          {canWrite && (status === "ready" || status === "approved") && !adjusting && (
            <div className="flex flex-wrap gap-2">
              {status === "ready" && (
                <button type="button" disabled={pending} onClick={() => act(() => approveTask(task.id))} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                  {m.approve}
                </button>
              )}
              <button type="button" onClick={() => setAdjusting(true)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                {m.adjust}
              </button>
            </div>
          )}
          {adjusting && (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                act(() => adjustTask(task.id, feedback), () => {
                  setAdjusting(false);
                  setFeedback("");
                });
              }}
            >
              <label className="block text-sm font-medium" htmlFor="task-feedback">
                {m.adjustTitle}
              </label>
              <textarea
                id="task-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={m.adjustPlaceholder}
                className="w-full rounded-xl border-0 bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand focus:outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={pending || !feedback.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {m.adjustSend}
                </button>
                <button type="button" onClick={() => setAdjusting(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                  {m.cancel}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {(error ?? runner.error) && <p className="text-sm text-red-700">{error ?? runner.error}</p>}

      {contributions.some((s) => s.output) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.contributions}</h2>
          {contributions.map(
            (step) =>
              step.output && (
                <details key={step.id} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" open={!final}>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <RoleAvatar member={step.role} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{name(step.role)}</span>
                      <span className="block text-xs text-slate-500">{step.output.samenvatting}</span>
                    </span>
                  </summary>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <Output output={step.output} />
                  </div>
                </details>
              ),
          )}
        </section>
      )}

      {task.earlier.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.earlier}</h2>
          {task.earlier.map((earlier) => (
            <details key={earlier.version} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <summary className="cursor-pointer text-sm font-semibold">{m.version(earlier.version)}</summary>
              <div className="mt-3">{earlier.final ? <Output output={earlier.final} /> : <p className="text-sm text-slate-500">{m.noFinal}</p>}</div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function Output({ output }: { output: CollaborationOutput }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-slate-900">{output.samenvatting}</p>
      <p className="whitespace-pre-line text-slate-700">{output.inhoud}</p>
      {output.aandachtspunten.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500">{m.attention}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
            {output.aandachtspunten.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
