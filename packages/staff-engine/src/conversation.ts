import { CONVERSATION_TASK, SHARED_TEXT_FILES } from "./layout";
import { validateOutput } from "./output";
import { renderTemplate, roleTask, sharedText } from "./prompt";
import { StaffGenerationError, type GenerateResult, type StaffModelProvider } from "./providers/types";
import type { Staff } from "./types";

/**
 * A conversation with one role of the staff. Keys are Dutch because this data
 * goes to the AI as-is. No names of players or opponents.
 */
export interface ConversationTurn {
  van: "hoofdcoach" | "rol";
  tekst: string;
}

export interface ConversationInput {
  /** The approved context of the team that every role may read. */
  teamcontext: Record<string, unknown>;
  /** Earlier turns of this conversation, oldest first (without the question). */
  gesprek: ConversationTurn[];
  vraag: string;
}

/** A joint task a role proposes; the head coach confirms it before it starts. */
export interface TaskProposal {
  titel: string;
  betrokken_rollen: string[];
  opdracht: string;
}

export interface ConversationReply {
  antwoord: string;
  taakvoorstel: TaskProposal | null;
}

export interface ConversationResult extends Omit<GenerateResult, "output"> {
  reply: ConversationReply;
  contentVersion: string;
}

/** Whether a role can be talked to (it has the conversation task in /staff). */
export function canConverse(staff: Staff, roleId: string): boolean {
  const role = staff.roles.find((r) => r.id === roleId);
  return !!role && !!roleTask(role, CONVERSATION_TASK);
}

/**
 * Builds the conversation prompt from the /staff templates, asks the provider
 * for the answer of the role and validates it. Unlike the week tasks this also
 * works for roles that are still a placeholder: in test mode they answer with
 * their examples.
 */
export async function runConversation(
  staff: Staff,
  roleId: string,
  input: ConversationInput,
  provider: StaffModelProvider,
): Promise<ConversationResult> {
  const role = staff.roles.find((r) => r.id === roleId);
  const task = role ? roleTask(role, CONVERSATION_TASK) : null;
  if (!role || !task) throw new StaffGenerationError("role_not_ready", `role ${roleId} has no conversation`);

  const example = task.examples.find((f) => f.path.endsWith(".json"));
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.conversationSystemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    rol: role.description.trim(),
    instructies: task.instructions.trim(),
    rollen: JSON.stringify(staff.roles.map((r) => ({ id: r.id, naam: r.meta.naam })), null, 2),
    voorbeeld: example ? example.content.trim() : "null",
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.conversationUserTemplate), {
    teamcontext: JSON.stringify(input.teamcontext, null, 2),
    gesprek: JSON.stringify(input.gesprek, null, 2),
    vraag: input.vraag,
  });

  const result = await provider.generate({
    staff,
    role,
    task: task.id,
    outputSchema: task.outputSchema,
    system,
    user,
    context: input,
  });
  const validation = validateOutput(task.outputSchema, result.output);
  if (!validation.ok) {
    throw new StaffGenerationError("invalid_output", "output does not match output-schema.json", validation.errors);
  }
  const reply = result.output as ConversationReply;
  // A role only involves roles that exist, and never itself.
  const known = new Set(staff.roles.map((r) => r.id));
  const proposal = reply.taakvoorstel
    ? { ...reply.taakvoorstel, betrokken_rollen: reply.taakvoorstel.betrokken_rollen.filter((id) => known.has(id) && id !== roleId) }
    : null;
  return {
    reply: { antwoord: reply.antwoord, taakvoorstel: proposal },
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    contentVersion: role.meta.versie,
  };
}
