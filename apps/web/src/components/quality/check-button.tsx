"use client";

import { useActionState } from "react";

import { checkQualityAction, type FormState } from "@/app/(app)/teams/[teamId]/weeks/actions";
import { messages } from "@/lib/messages";

const m = messages.quality;

/** Asks the staff to check (again) the quality of a week version. */
export function QualityCheckButton({
  teamId,
  weekStart,
  runId,
  again,
}: {
  teamId: string;
  weekStart: string;
  runId: string;
  again: boolean;
}) {
  const [state, action, pending] = useActionState<FormState>(checkQualityAction.bind(null, teamId, weekStart, runId), {});
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 disabled:opacity-50"
      >
        {pending ? m.checking : again ? m.recheck : m.check}
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
