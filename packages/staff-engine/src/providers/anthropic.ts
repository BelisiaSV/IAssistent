import Anthropic from "@anthropic-ai/sdk";

import { StaffGenerationError, type StaffModelProvider } from "./types";

export const DEFAULT_MODEL = "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** JSON Schema keys that structured outputs does not need. */
function forStructuredOutput(schema: Record<string, unknown>) {
  const { $schema: _schema, $id: _id, title: _title, ...rest } = schema;
  return rest;
}

/**
 * Claude via the Anthropic API. Server-side only (needs ANTHROPIC_API_KEY).
 * The answer is constrained to the role's output-schema.json (structured
 * outputs); refusals fall back to Anthropic's recommended model.
 */
export function anthropicProvider(options: {
  client?: Anthropic;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
} = {}): StaffModelProvider {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  return {
    id: "anthropic",
    async generate({ role, system, user }) {
      let message: Anthropic.Beta.BetaMessage;
      try {
        const stream = client.beta.messages.stream({
          model,
          max_tokens: options.maxTokens ?? 64000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: {
            effort: options.effort ?? "high",
            format: { type: "json_schema", schema: forStructuredOutput(role.outputSchema) },
          },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
        });
        message = await stream.finalMessage();
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new StaffGenerationError("provider_error", `Anthropic API ${error.status ?? ""}: ${error.message}`);
        }
        throw error;
      }

      if (message.stop_reason === "refusal") {
        throw new StaffGenerationError("refusal", "the model declined the request");
      }
      if (message.stop_reason === "max_tokens") {
        throw new StaffGenerationError("max_tokens", "the answer was cut off (max_tokens)");
      }

      const text = message.content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
      let output: unknown;
      try {
        output = JSON.parse(text);
      } catch {
        throw new StaffGenerationError("invalid_output", "the answer is not valid JSON");
      }
      return {
        output,
        provider: "anthropic",
        model: message.model,
        usage: { ...message.usage } as Record<string, unknown>,
      };
    },
  };
}
