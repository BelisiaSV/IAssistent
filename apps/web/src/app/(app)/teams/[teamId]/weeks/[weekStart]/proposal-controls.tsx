"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import type { WeekRoleId } from "@/lib/roles";

import { type FormState, requestProposal } from "../actions";

const m = messages.proposals;

export function RequestProposalButton({
  teamId,
  weekStart,
  roleId,
}: {
  teamId: string;
  weekStart: string;
  roleId: WeekRoleId;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestProposal.bind(null, teamId, weekStart, roleId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Button type="submit" disabled={pending}>
        {pending ? m.requesting : messages.roles[roleId].request}
      </Button>
    </form>
  );
}

export function AdjustProposalForm({
  teamId,
  weekStart,
  roleId,
}: {
  teamId: string;
  weekStart: string;
  roleId: WeekRoleId;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestProposal.bind(null, teamId, weekStart, roleId),
    {},
  );
  const r = messages.roles[roleId];
  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {m.adjust}
      </Button>
    );
  }
  return (
    <form action={action} className="w-full space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="adjust" value="1" />
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

/** Refreshes the page every few seconds while a proposal is being generated. */
export function RefreshWhileGenerating({ label }: { label: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <span className="h-3 w-3 animate-pulse rounded-full bg-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
