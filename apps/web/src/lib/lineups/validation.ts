import type { Formation } from "@iassistent/staff-engine/content";
import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.lineups.errors;

export const lineupDetailsSchema = (formationCodes: readonly string[]) =>
  z.object({
    title: z.string().trim().min(1, e.titleRequired).max(120),
    matchDate: z.union([z.literal("").transform(() => null), z.iso.date()]),
    opponent: z
      .string()
      .trim()
      .max(120)
      .transform((v) => (v === "" ? null : v)),
    formation: z.string().refine((c) => formationCodes.includes(c), e.formation),
  });

const playersSchema = z.object({
  starters: z.record(z.string(), z.uuid()),
  bench: z.array(z.uuid()).max(30),
});

/**
 * Validates the players of a lineup against its formation and the team's squad.
 * Returns null when invalid.
 */
export function parseLineupPlayers(
  raw: unknown,
  formation: Formation,
  squadIds: ReadonlySet<string>,
): { starters: Record<string, string>; bench: string[] } | null {
  const parsed = playersSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { starters, bench } = parsed.data;

  const slotIds = new Set(formation.posten.map((s) => s.id));
  const all = [...Object.values(starters), ...bench];
  if (Object.keys(starters).some((id) => !slotIds.has(id))) return null;
  if (new Set(all).size !== all.length) return null;
  if (all.some((id) => !squadIds.has(id))) return null;
  return { starters, bench };
}
