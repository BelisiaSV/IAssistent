import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import { playerInputSchema } from "./validation";

const schema = playerInputSchema(["GK", "CB", "ST"], new Date(2026, 9, 13));
const base = {
  firstName: " Jonas ",
  lastName: "Peeters",
  shirtNumber: "9",
  primaryPosition: "ST",
  secondaryPositions: ["CB", "ST", "CB"],
  preferredFoot: "right",
  birthYear: "1999",
  joinedClubYear: "2021",
  status: "available",
  expectedReturnDate: "2026-11-01",
  notes: "",
};

describe("playerInputSchema", () => {
  it("normalises a valid player", () => {
    expect(schema.parse(base)).toEqual({
      firstName: "Jonas",
      lastName: "Peeters",
      shirtNumber: 9,
      primaryPosition: "ST",
      secondaryPositions: ["CB"],
      preferredFoot: "right",
      birthYear: 1999,
      joinedClubYear: 2021,
      status: "available",
      expectedReturnDate: null,
      notes: null,
    });
  });

  it("keeps the expected return date only when injured", () => {
    expect(schema.parse({ ...base, status: "injured" }).expectedReturnDate).toBe("2026-11-01");
  });

  it("allows empty optional fields", () => {
    const parsed = schema.parse({
      ...base,
      shirtNumber: "",
      primaryPosition: "",
      preferredFoot: "",
      birthYear: "",
      joinedClubYear: "",
    });
    expect(parsed).toMatchObject({
      shirtNumber: null,
      primaryPosition: null,
      preferredFoot: null,
      birthYear: null,
      joinedClubYear: null,
    });
  });

  it("rejects positions that are not in the catalog", () => {
    const result = schema.safeParse({ ...base, primaryPosition: "XX" });
    expect(result.error?.issues[0]?.message).toBe(messages.players.errors.position);
  });

  it("rejects implausible numbers", () => {
    expect(schema.safeParse({ ...base, shirtNumber: "100" }).success).toBe(false);
    expect(schema.safeParse({ ...base, joinedClubYear: "2040" }).success).toBe(false);
    expect(schema.safeParse({ ...base, birthYear: "abc" }).success).toBe(false);
  });
});
