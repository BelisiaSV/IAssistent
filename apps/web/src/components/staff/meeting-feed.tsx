"use client";

import type { MeetingOverview } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";

import { messages } from "@/lib/messages";
import { applyMeetingToWeek, approveMeeting, type MeetingResult, retryMeeting } from "@/lib/staff-room/meeting-actions";
import { currentOverview, type MeetingView } from "@/lib/staff-room/meetings";
import { longDate } from "@/lib/weeks/dates";

import { RoleAvatar, staffColor } from "./role-avatar";
import { WeekPlanView } from "./week-plan-view";

const m = messages.staffRoom.meeting;

/**
 * The group chat of a staff meeting: the assignment of the head coach, every
 * role in turn (who it speaks to), a role "typing", the feedback of the head
 * coach between versions and the joint overview to approve or adjust.
 */
export function MeetingFeed({
  meeting,
  roleNames,
  names,
  canWrite,
  onChange,
}: {
  meeting: MeetingView;
  roleNames: Record<string, string>;
  /** Player names by shirt number, shown with the week plan. */
  names: Record<number, string>;
  canWrite: boolean;
  onChange: (meeting: MeetingView) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Week of the microcycle the plan was put in (in this view).
  const [week, setWeek] = useState<string | null>(null);
  const name = (id: string) => (id === "hoofdcoach" ? m.headCoach : (roleNames[id] ?? id));
  const speaking = meeting.status === "running" ? meeting.turns.find((t) => t.version === meeting.version && t.status !== "ready") : undefined;
  const overview = currentOverview(meeting);
  const readyCount = meeting.turns.filter((t) => t.status === "ready").length;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [readyCount, speaking?.id, meeting.status]);

  function act(action: () => Promise<MeetingResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.meeting) onChange(result.meeting);
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  const versions = Array.from({ length: meeting.version }, (_, i) => i + 1);
  return (
    <div className="space-y-4">
      <CoachBubble text={meeting.assignment} />
      {versions.map((version) => (
        <Fragment key={version}>
          {version > 1 && meeting.feedbacks[version - 2] && <CoachBubble text={meeting.feedbacks[version - 2]!} />}
          {meeting.turns
            .filter((t) => t.version === version && t.status === "ready" && t.message)
            .map((turn) => (
              <div key={turn.id} className="flex gap-3">
                <RoleAvatar member={turn.role} size={34} />
                <div className="min-w-0 max-w-3xl space-y-2">
                  <p className="text-xs">
                    <span className="font-semibold" style={{ color: staffColor(turn.role) }}>
                      {name(turn.role)}
                    </span>
                    {turn.to && <span className="text-slate-500"> → {m.to(name(turn.to))}</span>}
                    {turn.provider === "example" && (
                      <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{messages.staffRoom.testMode}</span>
                    )}
                  </p>
                  <div
                    className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-slate-800 ring-1 ring-slate-200"
                    style={{ borderLeft: `3px solid ${staffColor(turn.role)}` }}
                  >
                    {turn.message}
                  </div>
                  {turn.overview && version < meeting.version && <OverviewCard overview={turn.overview} roleNames={roleNames} names={names} muted />}
                </div>
              </div>
            ))}
        </Fragment>
      ))}

      {speaking && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RoleAvatar member={speaking.role} size={34} />
          <span className="flex items-center gap-2">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: staffColor(speaking.role), animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            {m.typing(name(speaking.role))}
          </span>
        </div>
      )}

      {meeting.status === "failed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <p className="flex-1 text-sm text-red-700">{m.failedHint}</p>
          {canWrite && (
            <button type="button" disabled={pending} onClick={() => act(() => retryMeeting(meeting.id))} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
              {m.retry}
            </button>
          )}
        </div>
      )}

      {overview && meeting.status !== "running" && (
        <div className="space-y-3">
          <OverviewCard overview={overview} roleNames={roleNames} names={names} />
          {meeting.status === "approved" && meeting.decidedAt && <p className="text-sm font-medium text-green-700">{m.approved(longDate(meeting.decidedAt.slice(0, 10)))}</p>}
          {canWrite && (
            <div className="flex flex-wrap items-center gap-3">
              {meeting.status === "ready" && (
                <button type="button" disabled={pending} onClick={() => act(() => approveMeeting(meeting.id))} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                  {m.approve}
                </button>
              )}
              {overview.weekplan && !week && (
                <button
                  type="button"
                  disabled={pending}
                  title={m.toWeek.hint}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const result = await applyMeetingToWeek(meeting.id);
                      if (result.weekStart) {
                        setWeek(result.weekStart);
                        if (meeting.status === "ready") onChange({ ...meeting, status: "approved", decidedAt: new Date().toISOString() });
                      }
                      if (result.error) setError(result.error);
                    })
                  }
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {pending ? m.toWeek.busy : m.toWeek.button}
                </button>
              )}
              {week && (
                <Link href={`/teams/${meeting.teamId}/weeks/${week}`} className="rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 ring-1 ring-green-200 hover:underline">
                  ✓ {m.toWeek.done} {m.toWeek.open} →
                </Link>
              )}
              <p className="text-sm text-slate-500">{m.replyHint}</p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div ref={bottom} />
    </div>
  );
}

function CoachBubble({ text }: { text: string }) {
  return (
    <div className="flex flex-row-reverse gap-3">
      <RoleAvatar member="head-coach" size={34} />
      <div className="max-w-3xl space-y-1 text-right">
        <p className="text-xs font-semibold text-slate-500">{m.you}</p>
        <div className="rounded-2xl rounded-tr-sm bg-brand px-3.5 py-2.5 text-left text-sm leading-relaxed whitespace-pre-line text-white">{text}</div>
      </div>
    </div>
  );
}

/** The joint overview of the staff. */
export function OverviewCard({
  overview,
  roleNames,
  names,
  muted = false,
}: {
  overview: MeetingOverview;
  roleNames: Record<string, string>;
  names: Record<number, string>;
  muted?: boolean;
}) {
  return (
    <section className={`space-y-4 rounded-2xl bg-white p-5 shadow-sm ${muted ? "opacity-70 ring-1 ring-slate-200" : "ring-2 ring-brand/50"}`}>
      <div>
        <p className="text-xs font-semibold tracking-wide text-brand uppercase">{m.overview}</p>
        <h3 className="text-lg font-bold tracking-tight">{overview.titel}</h3>
        <p className="mt-1 text-sm text-slate-700">{overview.samenvatting}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {overview.onderdelen.map((part) => (
          <div key={part.titel} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200" style={part.rol ? { borderTop: `3px solid ${staffColor(part.rol)}` } : undefined}>
            <div className="flex items-center gap-2">
              {part.rol && <RoleAvatar member={part.rol} size={22} />}
              <p className="text-sm font-semibold">{part.titel}</p>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-line text-slate-700">{part.inhoud}</p>
            {part.rol && <p className="mt-1.5 text-[11px] text-slate-500">{m.by(roleNames[part.rol] ?? part.rol)}</p>}
          </div>
        ))}
      </div>
      {overview.weekplan && <WeekPlanView plan={overview.weekplan} names={names} />}
      {overview.aandachtspunten.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500">{m.attention}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {overview.aandachtspunten.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
