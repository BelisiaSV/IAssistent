"use client";

import { useState } from "react";

import { messages } from "@/lib/messages";

const m = messages.proposals.share;

export function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2 print:hidden">
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        {copied ? m.copied : m.copy}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {m.print}
      </button>
    </div>
  );
}
