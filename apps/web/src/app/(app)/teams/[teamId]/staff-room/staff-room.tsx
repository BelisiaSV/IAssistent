"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { type FlowState, FlowBar } from "@/components/staff/flow-bar";
import { MeetingFeed } from "@/components/staff/meeting-feed";
import { RoleAvatar, staffColor } from "@/components/staff/role-avatar";
import { RoleChatPanel } from "@/components/staff/staff-dock";
import { StatusBadge, TaskProposalCard } from "@/components/staff/task-proposal-card";
import { useMeetingRunner } from "@/components/staff/use-meeting-runner";
import { messages } from "@/lib/messages";
import { adjustMeeting, startMeeting } from "@/lib/staff-room/meeting-actions";
import { currentOverview, type MeetingView } from "@/lib/staff-room/meetings";
import { MESSAGE_MAX } from "@/lib/staff-room/roles";
import type { TaskStatus } from "@/lib/staff-room/tasks";
import type { taskProposals } from "@/lib/staff-room/types";

const m = messages.staffRoom;
const mm = m.meeting;
const dateFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", timeZone: "Europe/Brussels" });

type HistoryItem = { id: string; assignment: string; status: TaskStatus; createdAt: string };

/**
 * The digital staff room: the head coach gives one assignment, the roles talk
 * it through in a group chat (with the light flow on top showing who speaks)
 * and one joint overview comes out. On the left the head coach consults one
 * role; on the right earlier assignments and tasks, one line each.
 */
export function StaffRoom({
  teamId,
  roles,
  roleNames,
  plan,
  history: initialHistory,
  initialMeeting,
  tasks,
  initialConsult,
  names,
  canWrite,
  testMode,
}: {
  teamId: string;
  roles: string[];
  roleNames: Record<string, string>;
  /** Roles in the order they speak (from /staff). */
  plan: string[];
  history: HistoryItem[];
  initialMeeting: MeetingView | null;
  tasks: ReturnType<typeof taskProposals>;
  initialConsult: string | null;
  /** Player names by shirt number (only shown, never sent to the AI). */
  names: Record<number, string>;
  canWrite: boolean;
  testMode: boolean;
}) {
  const { meeting, setMeeting, error, setError } = useMeetingRunner(initialMeeting);
  const [history, setHistory] = useState(initialHistory);
  const [consult, setConsult] = useState<string | null>(initialConsult);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function show(next: MeetingView) {
    setMeeting(next);
    setHistory((h) => [
      { id: next.id, assignment: next.assignment, status: next.status, createdAt: next.createdAt },
      ...h.filter((x) => x.id !== next.id),
    ]);
    window.history.replaceState(null, "", `?opdracht=${next.id}`);
  }

  // After the overview the box continues the conversation; otherwise it starts a new one.
  const replying = !!meeting && (meeting.status === "ready" || meeting.status === "approved");
  const busy = meeting?.status === "running" || meeting?.status === "failed";

  function send() {
    const value = text.trim();
    if (!value || busy) return;
    setError(null);
    startTransition(async () => {
      const result = replying ? await adjustMeeting(meeting!.id, value) : await startMeeting(teamId, value);
      if (result.meeting) {
        show(result.meeting);
        setText("");
      }
      if (result.error) setError(result.error);
    });
  }

  function close() {
    setMeeting(null);
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{mm.intro}</p>
        </div>
        {testMode && (
          <span title={m.testModeHint} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {m.testMode}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left: consult one role. */}
        <aside className="order-3 min-w-0 xl:order-1">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{mm.consult}</h2>
          <p className="mb-2 text-xs text-slate-500">{mm.consultHint}</p>
          <ul className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
            {roles.map((id) => (
              <li key={id} className="shrink-0 xl:shrink">
                <button
                  type="button"
                  onClick={() => setConsult(id)}
                  className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-slate-100"
                  title={m.openChat(roleNames[id] ?? id)}
                >
                  <RoleAvatar member={id} size={32} />
                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-sm font-semibold text-slate-900">{roleNames[id] ?? id}</span>
                    <span className="block truncate text-xs text-slate-500">{m.taglines[id]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Middle: the light flow, the group chat and the box for a new assignment. */}
        <section className="order-1 flex min-w-0 flex-col gap-4 xl:order-2">
          <FlowBar steps={flowSteps(meeting, plan)} overview={overviewState(meeting)} roleNames={roleNames} />
          {meeting && meeting.status !== "running" && (
            <div className="-mb-1 flex justify-end">
              <button
                type="button"
                onClick={close}
                title={mm.closeHint}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              >
                + {mm.close}
              </button>
            </div>
          )}
          <div className="h-[calc(100vh-22rem)] min-h-[420px] overflow-y-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            {meeting ? (
              <MeetingFeed key={meeting.id} meeting={meeting} roleNames={roleNames} names={names} canWrite={canWrite} onChange={show} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="flex -space-x-2">
                  {plan.map((id) => (
                    <RoleAvatar key={id} member={id} size={44} />
                  ))}
                </div>
                <p className="max-w-md text-sm text-slate-500">{mm.intro}</p>
              </div>
            )}
          </div>
          {canWrite && (
            <form
              className="flex items-end gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <RoleAvatar member="head-coach" size={36} />
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send();
                  }
                }}
                rows={2}
                maxLength={MESSAGE_MAX}
                aria-label={replying ? mm.reply : mm.label}
                placeholder={replying ? mm.replyPlaceholder : mm.placeholder}
                className="min-h-11 flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || pending || busy}
                className="h-11 shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                {pending ? mm.starting : replying ? mm.reply : mm.send}
              </button>
            </form>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>

        {/* Right: earlier assignments and tasks, one line each. */}
        <aside className="order-2 min-w-0 space-y-5 xl:order-3">
          <div>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{mm.history}</h2>
            {!history.length ? (
              <p className="text-sm text-slate-500">{mm.noHistory}</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                {history.map((item) => {
                  const status = item.id === meeting?.id ? meeting.status : item.status;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`?opdracht=${item.id}`}
                        className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${item.id === meeting?.id ? "bg-slate-50" : ""}`}
                        aria-current={item.id === meeting?.id ? "true" : undefined}
                      >
                        <StatusDot status={status} />
                        <span className="min-w-0 flex-1 truncate text-slate-800">{item.assignment}</span>
                        <span className="shrink-0 text-[11px] text-slate-400">{dateFormat.format(new Date(item.createdAt))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{m.tasks}</h2>
              {tasks.length > 0 && (
                <Link href={`/teams/${teamId}/tasks`} className="text-xs font-medium text-brand hover:underline">
                  {messages.nav.tasks} →
                </Link>
              )}
            </div>
            {!tasks.length ? (
              <p className="text-sm text-slate-500">{m.noTasks}</p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                        <span aria-hidden className="text-slate-400 transition group-open:rotate-90">
                          ▸
                        </span>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: staffColor(t.role) }} />
                        <span className="min-w-0 flex-1 truncate text-slate-800">{t.task.titel}</span>
                        <StatusBadge status={t.confirmed?.status ?? "proposed"} />
                      </summary>
                      <div className="space-y-2 px-3 pb-3">
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
                        <button type="button" onClick={() => setConsult(t.role)} className="text-xs font-medium text-brand hover:underline">
                          {messages.tasksPage.open} →
                        </button>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {consult && (
        <RoleChatPanel teamId={teamId} role={consult} roleNames={roleNames} testMode={testMode} onSelect={setConsult} onClose={() => setConsult(null)} />
      )}
    </div>
  );
}

const DOT: Record<TaskStatus, string> = { running: "#3b82f6", ready: "#f59e0b", failed: "#ef4444", approved: "#22c55e" };

function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      title={mm.status[status]}
      className={`h-2 w-2 shrink-0 rounded-full ${status === "running" ? "animate-pulse" : ""}`}
      style={{ backgroundColor: DOT[status] }}
    />
  );
}

/** The state of each role in the light flow, for the current version of the meeting. */
function flowSteps(meeting: MeetingView | null, plan: string[]): { role: string; state: FlowState }[] {
  if (!meeting) return plan.map((role) => ({ role, state: "waiting" }));
  const turns = meeting.turns.filter((t) => t.version === meeting.version && t.kind !== "overzicht");
  const order = [...new Set(turns.map((t) => t.role))];
  const speaking = meeting.status === "running" ? meeting.turns.find((t) => t.version === meeting.version && t.status !== "ready") : undefined;
  return (order.length ? order : plan).map((role) => ({
    role,
    state: speaking?.role === role ? "active" : turns.some((t) => t.role === role && t.status === "ready") ? "done" : "waiting",
  }));
}

function overviewState(meeting: MeetingView | null): FlowState {
  if (!meeting) return "waiting";
  if (currentOverview(meeting)) return "done";
  const speaking = meeting.turns.find((t) => t.version === meeting.version && t.status !== "ready");
  return meeting.status === "running" && speaking?.kind === "overzicht" ? "active" : "waiting";
}
