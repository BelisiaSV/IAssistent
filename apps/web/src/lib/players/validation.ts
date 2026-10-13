import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.players.errors;

export const PLAYER_STATUSES = ["available", "injured", "suspended", "unavailable"] as const;
export const PREFERRED_FEET = ["left", "right", "both"] as const;
export type PlayerStatus = (typeof PLAYER_STATUSES)[number];

const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

/** Player form schema. `positionCodes` comes from /staff/_gedeeld/posities.json. */
export function playerInputSchema(positionCodes: readonly string[], today = new Date()) {
  const year = today.getFullYear();
  const code = z.string().refine((c) => positionCodes.includes(c), e.position);

  return z
    .object({
      firstName: z.string().trim().min(1, e.firstNameRequired).max(80, e.tooLong),
      lastName: z.string().trim().min(1, e.lastNameRequired).max(80, e.tooLong),
      shirtNumber: optionalInt(1, 99, e.shirtNumber),
      primaryPosition: z.union([z.literal("").transform(() => null), code]),
      secondaryPositions: z.array(code).max(6),
      preferredFoot: z.union([z.literal("").transform(() => null), z.enum(PREFERRED_FEET)]),
      birthYear: optionalInt(1940, year, e.year),
      joinedClubYear: optionalInt(1950, year + 1, e.year),
      status: z.enum(PLAYER_STATUSES),
      expectedReturnDate: z.union([
        z.literal("").transform(() => null),
        z.iso.date(e.date),
      ]),
      notes: z
        .string()
        .trim()
        .max(500, e.tooLong)
        .transform((v) => (v === "" ? null : v)),
    })
    .transform((p) => ({
      ...p,
      secondaryPositions: [...new Set(p.secondaryPositions)].filter((c) => c !== p.primaryPosition),
      // Only kept while injured.
      expectedReturnDate: p.status === "injured" ? p.expectedReturnDate : null,
    }));
}

export type PlayerInput = z.output<ReturnType<typeof playerInputSchema>>;

export function playerFormValues(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    shirtNumber: String(formData.get("shirtNumber") ?? ""),
    primaryPosition: String(formData.get("primaryPosition") ?? ""),
    secondaryPositions: formData.getAll("secondaryPositions").map(String),
    preferredFoot: String(formData.get("preferredFoot") ?? ""),
    birthYear: String(formData.get("birthYear") ?? ""),
    joinedClubYear: String(formData.get("joinedClubYear") ?? ""),
    status: String(formData.get("status") ?? "available"),
    expectedReturnDate: String(formData.get("expectedReturnDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
