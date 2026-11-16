import { COLLABORATION_TASK, SHARED_TEXT_FILES } from "./layout";
import { validateOutput } from "./output";
import { renderTemplate, roleTask, sharedText } from "./prompt";
import { StaffGenerationError, type GenerateResult, type StaffModelProvider } from "./providers/types";
import type { Staff } from "./types";

/**
 * A joint task of several roles. The involved roles each add a contribution
 * ("bijdrage"); then the role that proposed the task turns everything into
 * one proposal for the head coach ("eindvoorstel"). Keys are Dutch because
 * this data goes to the AI as-is. No names of players or opponents.
 */
export type CollaborationPhase = "bijdrage" | "eindvoorstel";

export interface CollaborationTask {
  titel: string;
  opdracht: string;
  /** Role that proposed the task and makes the final proposal. */
  eigenaar: string;
  betrokken_rollen: string[];
  /** What the owner said when proposing the task (e.g. the exercises it chose). */
  aanleiding: string;
}

/** The output of a step, for a contribution as well as the final proposal. */
export interface CollaborationOutput {
  samenvatting: string;
  inhoud: string;
  aandachtspunten: string[];
}

export interface CollaborationInput {
  teamcontext: Record<string, unknown>;
  taak: CollaborationTask;
  fase: CollaborationPhase;
  /** Earlier contributions of this task, in order. */
  bijdragen: ({ rol: string } & CollaborationOutput)[];
  /** The previous final proposal and what the head coach wants changed, or null. */
  feedback: { vorige_versie: CollaborationOutput; feedback: string } | null;
}

export interface CollaborationResult extends Omit<GenerateResult, "output"> {
  output: CollaborationOutput;
  contentVersion: string;
}

/** Whether a role can work on joint tasks (it has the collaboration task in /staff). */
export function canCollaborate(staff: Staff, roleId: string): boolean {
  const role = staff.roles.find((r) => r.id === roleId);
  return !!role && !!roleTask(role, COLLABORATION_TASK);
}

/**
 * One step of a joint task: builds the prompt from the /staff templates, asks
 * the provider and validates the output. Works for placeholder roles too: in
 * test mode they answer with their examples.
 */
export async function runCollaboration(
  staff: Staff,
  roleId: string,
  input: CollaborationInput,
  provider: StaffModelProvider,
): Promise<CollaborationResult> {
  const role = staff.roles.find((r) => r.id === roleId);
  const task = role ? roleTask(role, COLLABORATION_TASK) : null;
  if (!role || !task) throw new StaffGenerationError("role_not_ready", `role ${roleId} cannot work on joint tasks`);

  const example =
    task.examples.find((f) => f.path.endsWith(".json") && f.path.split("/").pop()!.startsWith(input.fase)) ??
    task.examples.find((f) => f.path.endsWith(".json"));
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.collaborationSystemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    rol: role.description.trim(),
    instructies: task.instructions.trim(),
    rollen: JSON.stringify(staff.roles.map((r) => ({ id: r.id, naam: r.meta.naam })), null, 2),
    voorbeeld: example ? example.content.trim() : "null",
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.collaborationUserTemplate), {
    teamcontext: JSON.stringify(input.teamcontext, null, 2),
    taak: JSON.stringify(input.taak, null, 2),
    fase: input.fase,
    bijdragen: JSON.stringify(input.bijdragen, null, 2),
    feedback: JSON.stringify(input.feedback, null, 2),
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
  return {
    output: result.output as CollaborationOutput,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    contentVersion: role.meta.versie,
  };
}
