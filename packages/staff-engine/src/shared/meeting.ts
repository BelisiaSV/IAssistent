import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import { fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.meeting}`;

/** Kinds of turns in a staff meeting. */
export const MEETING_TURN_KINDS = ["opening", "bijdrage", "reactie", "overzicht"] as const;
export type MeetingTurnKind = (typeof MEETING_TURN_KINDS)[number];

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  beurten: z
    .array(
      z.object({
        rol: z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/),
        soort: z.enum(MEETING_TURN_KINDS),
        uitleg: z.string().optional(),
      }),
    )
    .min(2)
    .max(16),
});

/** The order in which the staff speaks in the Staff Room (_gedeeld/staffkamer.json). */
export type MeetingPlan = z.infer<typeof schema>;

export function parseMeetingPlan(data: unknown): ParseResult<MeetingPlan> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const turns = parsed.value.beurten;
  const errors: string[] = [];
  if (turns.filter((t) => t.soort === "overzicht").length !== 1 || turns.at(-1)?.soort !== "overzicht") {
    errors.push("precies één beurt met soort \"overzicht\", als laatste");
  }
  if (turns.some((t, i) => t.soort === "opening" && i !== 0)) errors.push("een \"opening\" kan enkel de eerste beurt zijn");
  return errors.length ? fail(FILE, errors) : parsed;
}
