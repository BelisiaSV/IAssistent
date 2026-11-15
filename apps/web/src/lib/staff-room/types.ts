import type { TaskProposal } from "@iassistent/staff-engine/content";

/** A message in a conversation with a role, as the app shows it. */
export interface ChatMessage {
  id: string;
  role: string;
  author: "coach" | "role";
  content: string;
  taskProposal: TaskProposal | null;
  /** "example" in test mode. */
  provider: string | null;
  createdAt: string;
}

export function toChatMessage(row: {
  id: string;
  role: string;
  author: "coach" | "role";
  content: string;
  task_proposal: unknown;
  provider: string | null;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    author: row.author,
    content: row.content,
    taskProposal: taskProposal(row.task_proposal),
    provider: row.provider,
    createdAt: row.created_at,
  };
}

/** A stored task proposal, or null when it is missing or malformed. */
export function taskProposal(raw: unknown): TaskProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.titel !== "string" || typeof t.opdracht !== "string" || !Array.isArray(t.betrokken_rollen)) return null;
  return { titel: t.titel, opdracht: t.opdracht, betrokken_rollen: t.betrokken_rollen.filter((r): r is string => typeof r === "string") };
}

/** Every task proposal of the team, newest first, with the role that proposed it. */
export function taskProposals(messages: readonly ChatMessage[]) {
  return messages
    .flatMap((msg) => (msg.taskProposal ? [{ id: msg.id, role: msg.role, createdAt: msg.createdAt, task: msg.taskProposal }] : []))
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const MESSAGE_COLUMNS = "id, role, author, content, task_proposal, provider, created_at";
