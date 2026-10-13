import type { RoleContext } from "../context";
import type { Staff, StaffRole } from "../types";

export interface GenerateRequest {
  staff: Staff;
  role: StaffRole;
  system: string;
  user: string;
  context: RoleContext;
}

export interface GenerateResult {
  output: unknown;
  provider: "example" | "anthropic";
  model: string | null;
  usage: Record<string, unknown> | null;
}

export interface StaffModelProvider {
  id: GenerateResult["provider"];
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export type StaffGenerationErrorCode =
  | "role_not_ready"
  | "refusal"
  | "max_tokens"
  | "invalid_output"
  | "provider_error";

export class StaffGenerationError extends Error {
  constructor(
    public readonly code: StaffGenerationErrorCode,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "StaffGenerationError";
  }
}
