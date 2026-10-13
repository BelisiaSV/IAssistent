import "server-only";

import {
  anthropicProvider,
  DEFAULT_MODEL,
  exampleProvider,
  type StaffModelProvider,
} from "@iassistent/staff-engine";

/**
 * Which model the AI staff uses. Default: test mode (no AI, content from
 * /staff/*\/voorbeelden). The real AI only runs when STAFF_AI_PROVIDER=anthropic
 * and ANTHROPIC_API_KEY are set (server-side only, never NEXT_PUBLIC_).
 */
export function getStaffProvider(): StaffModelProvider {
  if (process.env.STAFF_AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return anthropicProvider({ model: process.env.STAFF_AI_MODEL || DEFAULT_MODEL });
  }
  return exampleProvider;
}
