"use client";

import { messages } from "@/lib/messages";

export function DeleteLineupButton({
  action,
  teamId,
  lineupId,
}: {
  action: (formData: FormData) => Promise<void>;
  teamId: string;
  lineupId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(messages.lineups.deleteConfirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="lineupId" value={lineupId} />
      <button type="submit" className="text-sm text-red-700 hover:underline">
        {messages.common.delete}
      </button>
    </form>
  );
}
