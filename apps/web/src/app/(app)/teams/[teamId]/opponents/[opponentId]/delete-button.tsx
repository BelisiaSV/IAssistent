"use client";

import { messages } from "@/lib/messages";

import { deleteOpponent } from "../actions";

export function DeleteOpponentButton({ teamId, opponentId }: { teamId: string; opponentId: string }) {
  return (
    <form
      action={deleteOpponent}
      onSubmit={(e) => {
        if (!confirm(messages.opponents.deleteConfirm)) e.preventDefault();
      }}
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="opponentId" value={opponentId} />
      <button type="submit" className="text-sm text-red-700 hover:underline">
        {messages.opponents.delete}
      </button>
    </form>
  );
}
