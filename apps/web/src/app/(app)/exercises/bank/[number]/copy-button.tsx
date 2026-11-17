"use client";

import { useFormStatus } from "react-dom";

import { messages } from "@/lib/messages";

const m = messages.exerciseBank.coach;

export function CopyButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">
      {pending ? m.copying : m.copy}
    </button>
  );
}
