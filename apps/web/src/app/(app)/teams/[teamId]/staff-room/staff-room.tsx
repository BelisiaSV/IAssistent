"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ChatThread } from "@/components/staff/chat-thread";
import { RoleAvatar, staffColor } from "@/components/staff/role-avatar";
import { TaskProposalCard } from "@/components/staff/task-proposal-card";
import { messages } from "@/lib/messages";
import { MESSAGE_MAX } from "@/lib/staff-room/roles";
import { type ChatMessage, taskProposals } from "@/lib/staff-room/types";

const m = messages.staffRoom;
/** Tasks shown in the column on the right; the rest is on the Tasks page. */
const TASKS_SHOWN = 4;

/**
 * The digital staff room: a new assignment on top, the roles on the left, the
 * conversation with the selected role in the middle and the tasks with the
 * roles involved and their progress on the right.
 */
export function StaffRoom({
  teamId,
  roles,
  roleNames,
  initialRole,
  initialMessages,
  canWrite,
  testMode,
}: {
  teamId: string;
  roles: string[];
  roleNames: Record<string, string>;
  initialRole: string;
  initialMessages: ChatMessage[];
  canWrite: boolean;
  testMode: boolean;
}) {
  const [role, setRole] = useState(initialRole);
  const [all, setAll] = useState(initialMessages);
  const [assignment, setAssignment] = useState("");
  const [draft, setDraft] = useState<{ text: string } | null>(null);

  const thread = useMemo(() => ({ messages: all.filter((msg) => msg.role === role), canWrite }), [all, role, canWrite]);
  const tasks = useMemo(() => taskProposals(all), [all]);
  const coordinator = roles[0]!;

  function select(id: string) {
    setRole(id);
    setDraft(null);
    // Keep the address in sync without a new request (sharing or reloading opens the same role).
    window.history.replaceState(null, "", `?rol=${id}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
        </div>
        {testMode && (
          <span title={m.testModeHint} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {m.testMode}
          </span>
        )}
      </div>

      {canWrite && (
        <form
          className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            const text = assignment.trim();
            if (!text) return;
            select(coordinator);
            setDraft({ text });
            setAssignment("");
          }}
        >
          <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
            <RoleAvatar member={coordinator} size={36} />
            <div>
              <p className="text-sm font-semibold">{m.newTask}</p>
              <p className="text-xs text-slate-500">{roleNames[coordinator]}</p>
            </div>
          </div>
          <input
            value={assignment}
            onChange={(event) => setAssignment(event.target.value)}
            maxLength={MESSAGE_MAX}
            placeholder={m.newTaskPlaceholder}
            aria-label={m.newTask}
            title={m.newTaskHint}
            className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-slate-50 px-3 text-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={!assignment.trim()}
            className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            {m.newTaskSend}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[270px_minmax(0,1fr)_330px]">
        {/* Left: the roles. */}
        <section aria-label={m.roles} className="min-w-0">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.roles}</h2>
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {roles.map((id) => {
              const last = all.findLast((msg) => msg.role === id);
              const current = id === role;
              return (
                <li key={id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => select(id)}
                    aria-pressed={current}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition lg:p-2.5 ${
                      current ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-slate-100"
                    }`}
                    style={current ? { boxShadow: `inset 3px 0 0 ${staffColor(id)}` } : undefined}
                  >
                    <RoleAvatar member={id} size={38} />
                    <span className="hidden min-w-0 flex-1 lg:block">
                      <span className="block truncate text-sm font-semibold text-slate-900">{roleNames[id] ?? id}</span>
                      <span className="block truncate text-xs text-slate-500">{last ? last.content : m.taglines[id]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Middle: the conversation. */}
        <section className="flex h-[calc(100vh-17rem)] min-h-[460px] min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <RoleAvatar member={role} size={40} />
            <div className="min-w-0">
              <h2 className="truncate font-semibold">{roleNames[role] ?? role}</h2>
              <p className="truncate text-xs text-slate-500">{m.taglines[role]}</p>
            </div>
          </header>
          <ChatThread
            key={role}
            teamId={teamId}
            role={role}
            roleNames={roleNames}
            initial={thread}
            draft={role === coordinator ? draft : null}
            onMessages={(added) => setAll((current) => [...current, ...added])}
            className="flex-1"
          />
        </section>

        {/* Right: tasks, the roles involved and the progress. */}
        <aside className="min-w-0 space-y-3 lg:col-span-2 2xl:col-span-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.tasks}</h2>
            {tasks.length > 0 && (
              <Link href={`/teams/${teamId}/tasks`} className="text-xs font-medium text-brand hover:underline">
                {messages.nav.tasks} →
              </Link>
            )}
          </div>
          {!tasks.length ? (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">{m.noTasks}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-1">
              {tasks.slice(0, TASKS_SHOWN).map((t) => (
                <li key={t.id}>
                  <TaskProposalCard
                    task={t.task}
                    roleNames={roleNames}
                    owner={t.role}
                    showOwner
                    messageId={t.id}
                    teamId={teamId}
                    confirmed={t.confirmed}
                    canWrite={canWrite}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">{m.tasksHint}</p>
        </aside>
      </div>
    </div>
  );
}
