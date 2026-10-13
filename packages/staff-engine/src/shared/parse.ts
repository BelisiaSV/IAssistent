import type { z } from "zod";

import type { StaffIssue } from "../types";

export type ParseResult<T> = { value: T; issues: [] } | { value: null; issues: StaffIssue[] };

/** Runs a zod schema and turns its issues into StaffIssues for `filePath`. */
export function parseWith<T>(schema: z.ZodType<T>, data: unknown, filePath: string): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { value: result.data, issues: [] };
  return {
    value: null,
    issues: result.error.issues.map((issue) => ({
      path: filePath,
      message: `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}`,
    })),
  };
}

export function fail<T>(filePath: string, messages: string[]): ParseResult<T> {
  return { value: null, issues: messages.map((message) => ({ path: filePath, message })) };
}

export function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) (seen.has(v) ? dups : seen).add(v);
  return [...dups];
}
