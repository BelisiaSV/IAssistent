import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.taskRouting}`;
const roleId = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  standaard: roleId,
  rollen: z
    .array(z.object({ rol: roleId, woorden: z.array(z.string().trim().min(2).max(40)).min(1).max(60) }))
    .min(1)
    .max(20),
});

/** Which role gets a task of the head coach (_gedeeld/taakroutering.json). */
export type TaskRouting = z.infer<typeof schema>;

export function parseTaskRouting(data: unknown): ParseResult<TaskRouting> {
  return parseWith(schema, data, FILE);
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The role a task goes to: the one with the most words found in the task (a
 * word also counts as the start of a longer word); the default without any.
 */
export function routeTask(routing: TaskRouting, text: string): string {
  const words = normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
  const joined = ` ${words.join(" ")} `;
  let best = { role: routing.standaard, score: 0 };
  for (const { rol, woorden } of routing.rollen) {
    const score = woorden.filter((w) => {
      const term = normalize(w).trim();
      // Several words ("vrije trap") must follow each other; one word may start a longer one.
      return term.includes(" ") ? joined.includes(` ${term}`) : words.some((x) => x.startsWith(term));
    }).length;
    if (score > best.score) best = { role: rol, score };
  }
  return best.role;
}
