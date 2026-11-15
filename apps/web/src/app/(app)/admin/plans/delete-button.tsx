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
      className="text-sm font-medium text-red-700 hover:underline"
    >
      {messages.plans.delete}
    </button>
  );
}
