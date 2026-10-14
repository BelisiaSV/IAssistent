"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { RunKind } from "@/lib/roles";

import { continueRun, type FormState, requestRun } from "../actions";

const m = messages.proposals;
const r = messages.staffRun;

export function RequestRunButton({
  teamId,
  weekStart,
  kind,
  label,
}: {
  teamId: string;
  weekStart: string;
  kind: RunKind;
  label: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestRun.bind(null, teamId, weekStart, kind), {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? m.requesting : label}
      </Button>
    </form>
  );
}

export function RetryRunButton({
  teamId,
  weekStart,
  kind,
  runId,
}: {
  teamId: string;
  weekStart: string;
  kind: RunKind;
  runId: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestRun.bind(null, teamId, weekStart, kind), {});
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="basedOn" value={runId} />
      <input type="hidden" name="retry" value="1" />
      <Button type="submit" disabled={pending}>
        {pending ? m.requesting : r.retry}
      </Button>
    </form>
  );
}

/** Feedback on a version: for the whole staff or for one step (and what builds on it). */
export function AdjustRunForm({
  teamId,
  weekStart,
  kind,
  runId,
  steps,
}: {
  teamId: string;
  weekStart: string;
  kind: RunKind;
  runId: string;
  steps: { key: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(requestRun.bind(null, teamId, weekStart, kind), {});
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {r.adjust}
      </Button>
    );
  }
  return (
    <form action={action} className="w-full space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="basedOn" value={runId} />
      {steps.length > 1 && (
        <label className="block text-sm font-medium text-slate-700">
          {r.adjustFor}
          <select name="step" defaultValue="" className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">{r.wholeStaff}</option>
            {steps.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">{r.adjustHint}</span>
        </label>
      )}
      <label className="block text-sm font-medium text-slate-700">
        {r.adjustTitle}
        <textarea
          name="feedback"
          required
          rows={3}
          maxLength={2000}
          placeholder={r.adjustPlaceholder}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          {messages.common.cancel}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? m.requesting : m.adjustSubmit}
        </Button>
      </div>
    </form>
  );
}

/**
 * While a run is busy: asks the server every few seconds to start the next
 * steps (each step runs in its own request) and refreshes the page.
 */
export function RunProgress({
  teamId,
  weekStart,
  runId,
  label,
  steps,
}: {
  teamId: string;
  weekStart: string;
  runId: string;
  label: string;
  steps: { key: string; name: string; status: keyof typeof r.stepStatus }[];
}) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        await continueRun(teamId, weekStart, runId);
      } finally {
        if (active) router.refresh();
      }
    };
    void tick();
    const timer = setInterval(tick, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [teamId, weekStart, runId, router]);

  return (
    <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-pulse rounded-full bg-brand" />
        <span className="text-sm">{label}</span>
      </div>
      <StepList steps={steps} />
    </div>
  );
}

export function StepList({ steps }: { steps: { key: string; name: string; status: keyof typeof r.stepStatus }[] }) {
  const tone: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600",
    generating: "bg-blue-100 text-blue-800 animate-pulse",
    ready: "bg-green-100 text-green-800",
    approved: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    rejected: "bg-slate-100 text-slate-600",
  };
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {steps.map((s) => (
        <li key={s.key} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <span>{s.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[s.status] ?? ""}`}>{r.stepStatus[s.status]}</span>
        </li>
      ))}
    </ol>
  );
}
