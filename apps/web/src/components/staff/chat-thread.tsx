"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { NavIcon } from "@/components/nav-icons";
import { messages } from "@/lib/messages";
import { loadThread, sendMessage } from "@/lib/staff-room/actions";
import { MESSAGE_MAX } from "@/lib/staff-room/roles";
import type { ChatMessage } from "@/lib/staff-room/types";

import { RoleAvatar } from "./role-avatar";
import { TaskProposalCard } from "./task-proposal-card";

const m = messages.staffRoom;

const timeFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });

/**
 * The conversation of the head coach with one role: the messages, a task the
 * role proposes, and the box to write. Loads the thread itself when it gets
 * no messages from the server.
 */
export function ChatThread({
  teamId,
  role,
  roleNames,
  initial,
  onMessages,
  draft,
  className = "",
}: {
  teamId: string;
  role: string;
  roleNames: Record<string, string>;
  initial?: { messages: ChatMessage[]; canWrite: boolean };
  /** Called with the new messages after sending (e.g. to update a list of tasks). */
  onMessages?: (added: ChatMessage[]) => void;
  /** A message to send right away (e.g. a new assignment from the top of the Staff Room). */
  draft?: { text: string } | null;
  className?: string;
}) {
  const name = roleNames[role] ?? role;
  const [thread, setThread] = useState<{ messages: ChatMessage[]; canWrite: boolean } | null>(initial ?? null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    loadThread(teamId, role).then((result) => {
      if (cancelled) return;
      if ("error" in result) setError(result.error);
      else setThread(result);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, role, initial]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread?.messages.length, pending]);

  function send(value: string) {
    const question = value.trim();
    if (!question || pending) return;
    setError(null);
    setPending(question);
    setText("");
    startTransition(async () => {
      const result = await sendMessage(teamId, role, question);
      setPending(null);
      if (result.messages.length) {
        setThread((t) => ({ canWrite: t?.canWrite ?? true, messages: [...(t?.messages ?? []), ...result.messages] }));
        onMessages?.(result.messages);
      } else {
        setText(question);
      }
      if (result.error) setError(result.error);
    });
  }

  // A new assignment from outside the thread (top of the Staff Room): send it once.
  const handled = useRef<typeof draft>(null);
  useEffect(() => {
    if (!draft || handled.current === draft || !thread) return;
    handled.current = draft;
    queueMicrotask(() => send(draft.text));
    // send only depends on state that is current at this point
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, thread]);

  const list = thread?.messages ?? [];
  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!thread && !error && <p className="text-sm text-slate-500">{m.sending}</p>}
        {thread && !list.length && !pending && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <RoleAvatar member={role} size={56} />
            <p className="max-w-xs text-sm text-slate-500">{m.empty(name)}</p>
          </div>
        )}
        {list.map((msg) => (
          <Bubble key={msg.id} msg={msg} name={name} roleNames={roleNames} />
        ))}
        {pending && (
          <>
            <Bubble msg={{ id: "pending", role, author: "coach", content: pending, taskProposal: null, provider: null, createdAt: "" }} name={name} roleNames={roleNames} />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RoleAvatar member={role} size={28} />
              <span className="animate-pulse">{m.thinking(name)}</span>
            </div>
          </>
        )}
        <div ref={bottom} />
      </div>

      {error && <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      {thread && !thread.canWrite ? (
        <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">{m.readOnly}</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-slate-200 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(text);
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(text);
              }
            }}
            rows={2}
            maxLength={MESSAGE_MAX}
            placeholder={m.placeholder(name)}
            aria-label={m.placeholder(name)}
            disabled={!thread}
            className="min-h-11 flex-1 resize-none rounded-xl border-0 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || !!pending || !thread}
            aria-label={m.send}
            title={m.send}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-40"
          >
            <NavIcon name="send" className="h-5 w-5" />
          </button>
        </form>
      )}
    </div>
  );
}

function Bubble({ msg, name, roleNames }: { msg: ChatMessage; name: string; roleNames: Record<string, string> }) {
  const coach = msg.author === "coach";
  return (
    <div className={`flex gap-2.5 ${coach ? "flex-row-reverse" : ""}`}>
      <RoleAvatar member={coach ? "head-coach" : msg.role} size={30} />
      <div className={`min-w-0 max-w-[85%] space-y-2 ${coach ? "items-end text-right" : ""}`}>
        <p className="text-[11px] text-slate-500">
          {coach ? m.you : name}
          {msg.createdAt && ` · ${timeFormat.format(new Date(msg.createdAt))}`}
          {!coach && msg.provider === "example" && (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{m.testMode}</span>
          )}
        </p>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed whitespace-pre-line ${
            coach ? "rounded-tr-sm bg-brand text-white" : "rounded-tl-sm bg-slate-100 text-slate-900"
          }`}
        >
          {msg.content}
        </div>
        {msg.taskProposal && <TaskProposalCard task={msg.taskProposal} roleNames={roleNames} owner={msg.role} />}
      </div>
    </div>
  );
}
