import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.opponents.errors;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

export const opponentNameSchema = z.string().trim().min(1, e.name).max(120, e.name);

export const opponentFicheSchema = z.object({
  name: opponentNameSchema,
  playStyle: optionalText(1000, e.tooLong),
  strengths: optionalText(1000, e.tooLong),
  weaknesses: optionalText(1000, e.tooLong),
  setPieces: optionalText(1000, e.tooLong),
  notes: optionalText(2000, e.tooLong),
  coachName: optionalText(120, e.tooLong),
  address: optionalText(200, e.tooLong),
});

const shirtNumber = z.number().int(e.number).min(1, e.number).max(99, e.number).nullable();
const opponentPlayerSchema = z.object({
  number: shirtNumber,
  name: z.string().trim().max(80, e.tooLong).default(""),
});
export type OpponentPlayer = z.infer<typeof opponentPlayerSchema>;

/** Opponent lineup as stored: shirt number + name per slot and on the bench. */
export const opponentLineupSchema = z.object({
  formation: z.string().min(1).max(20),
  starters: z.record(z.string(), opponentPlayerSchema),
  bench: z.array(opponentPlayerSchema).max(12),
});
export type OpponentLineupInput = z.infer<typeof opponentLineupSchema>;

/** Drops empty entries (no number and no name). */
export function compactLineup(lineup: OpponentLineupInput, slotIds: ReadonlySet<string>): OpponentLineupInput {
  const filled = (p: OpponentPlayer) => p.number !== null || p.name !== "";
  return {
    formation: lineup.formation,
    starters: Object.fromEntries(Object.entries(lineup.starters).filter(([slot, p]) => slotIds.has(slot) && filled(p))),
    bench: lineup.bench.filter(filled),
  };
}

const goals = z.union([
  z.literal("").transform(() => null),
  z.coerce.number().int(messages.matchReport.errors.score).min(0, messages.matchReport.errors.score).max(50, messages.matchReport.errors.score),
]);
const reportText = optionalText(2000, messages.matchReport.errors.tooLong);
const formationCode = z
  .string()
  .max(20)
  .transform((v) => (v === "" ? null : v));

export const matchReportSchema = z.object({
  goalsFor: goals,
  goalsAgainst: goals,
  ownFormation: formationCode,
  opponentFormation: formationCode,
  wentWell: reportText,
  wentBadly: reportText,
  lessons: reportText,
});
