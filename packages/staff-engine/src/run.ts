import type { RoleContext } from "./context";
import { validateOutput } from "./output";
import { buildRolePrompt } from "./prompt";
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
): Promise<RoleRunResult> {
  const role = staff.roles.find((r) => r.id === roleId);
  if (!role || role.meta.status === "placeholder") {
    throw new StaffGenerationError("role_not_ready", `role ${roleId} is not available`);
  }
  const { system, user } = buildRolePrompt(staff, role, context);
  const result = await provider.generate({ staff, role, system, user, context });

  const validation = validateOutput(role.outputSchema, result.output);
  if (!validation.ok) {
    throw new StaffGenerationError("invalid_output", "output does not match output-schema.json", validation.errors);
  }
  return { ...result, contentVersion: role.meta.versie };
}
