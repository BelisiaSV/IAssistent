import type { RoleContext } from "./context";
import { validateOutput } from "./output";
import { DEFAULT_TASK } from "./layout";
import { buildRolePrompt, roleTask } from "./prompt";
import { StaffGenerationError, type GenerateResult, type StaffModelProvider } from "./providers/types";
import type { Staff } from "./types";

export interface RoleRunResult extends GenerateResult {
  /** Version of the role content (rol.md frontmatter) that produced the output. */
  contentVersion: string;
}

/** Builds the prompt from /staff, asks the provider and validates the output. */
export async function runRole(
  staff: Staff,
  roleId: string,
  context: RoleContext,
  provider: StaffModelProvider,
  taskId: string = DEFAULT_TASK,
): Promise<RoleRunResult> {
  const role = staff.roles.find((r) => r.id === roleId);
  const task = role ? roleTask(role, taskId) : null;
  if (!role || !task || role.meta.status === "placeholder") {
    throw new StaffGenerationError("role_not_ready", `role ${roleId} (${taskId}) is not available`);
  }
  const { system, user } = buildRolePrompt(staff, role, context, taskId);
  const result = await provider.generate({
    staff,
    role,
    task: task.id,
    outputSchema: task.outputSchema,
    system,
    user,
    context,
  });

  const validation = validateOutput(task.outputSchema, result.output);
  if (!validation.ok) {
    throw new StaffGenerationError("invalid_output", "output does not match output-schema.json", validation.errors);
  }
  return { ...result, contentVersion: role.meta.versie };
}
