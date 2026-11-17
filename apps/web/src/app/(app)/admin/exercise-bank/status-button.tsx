"use client";

import { useState, useTransition } from "react";

import { messages } from "@/lib/messages";

import { setBankStatus } from "./actions";

const m = messages.exerciseBank.admin;

export function StatusButton({
  id,
  status,
}: {
  id: string;
  status: "review" | "approved";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = status === "approved" ? "review" : "approved";
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={(event) => {
          // The button sits in the summary of a <details>: do not open or close it.
          event.preventDefault();
          startTransition(async () => {
            const result = await setBankStatus(id, next);
            setError(result.error ?? null);
          });
        }}
        className={`rounded-md px-2.5 py-1 text-xs font-semibold ring-1 disabled:opacity-50 ${next === "approved" ? "bg-green-600 text-white ring-green-600 hover:bg-green-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-100"}`}
      >
        {next === "approved" ? m.approve : m.unapprove}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
