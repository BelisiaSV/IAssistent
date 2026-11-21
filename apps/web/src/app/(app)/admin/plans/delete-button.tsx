"use client";

import { messages } from "@/lib/messages";

/** Delete with a confirmation; the surrounding form posts the plan id. */
export function DeleteButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(messages.plans.deleteConfirm)) e.preventDefault();
      }}
      className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
    >
      {messages.plans.delete}
    </button>
  );
}
