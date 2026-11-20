import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import {
  CLUB_COLUMNS,
  type ClubImport,
  hasErrors,
  parseClubImport,
  seatsNeeded,
  STAFF_COLUMNS,
  TEAM_COLUMNS,
  toImportPayload,
} from "./import";

const col = messages.clubAdmin.excel.columns;
const header = (cols: readonly (keyof typeof col)[]) => cols.map((c) => col[c]);

function sheets(club: string[][], teams: string[][], staff: string[][]) {
  return {
    club: [header(CLUB_COLUMNS), ...club],
    teams: [header(TEAM_COLUMNS), ...teams],
    staff: [header(STAFF_COLUMNS), ...staff],
  };
}

function ok(result: ReturnType<typeof parseClubImport>): ClubImport {
  if ("error" in result) throw new Error(result.error);
  return result;
}

describe("parseClubImport", () => {
  it("reads club, teams and staff with labels from the lists", () => {
    const data = ok(
      parseClubImport(
        sheets(
          [
            [
              "Belisia Bilzen SV",
              "00042",
              "Sportlaan 1",
              "Jan",
              "jan@club.be",
              "0470",
              "#6cb4ee",
              "#FFFFFF",
            ],
          ],
          [
            [
              "A-ploeg",
              "Seniorenelftal",
              "2026-2027",
              "Belisia Bilzen SV A",
              "3B",
            ],
            ["U17", "U17", "2026-2027", "", ""],
          ],
          [
            ["Jordy", "Club Owner", "", ""],
            ["Tom", "Coach", "U17", "Hoofdtrainer"],
            ["Lien", "Teamcoördinator", "a-ploeg", "Coördinator"],
            ["Piet", "Club Admin", "", ""],
          ],
        ),
      ),
    );
    expect(hasErrors(data)).toBe(false);
    expect(data.club.primaryColor).toBe("#6CB4EE");
    expect(data.teams.map((t) => t.ageCategory)).toEqual(["senioren", "u17"]);
    expect(data.teams[0]!.divisions).toEqual(["3B"]);
    expect(data.staff.map((s) => s.role)).toEqual([
      "owner",
      "coach",
      "team_coordinator",
      "admin",
    ]);
    expect(data.staff[1]!.teamRole).toBe("head_coach");
    expect(seatsNeeded(data.staff)).toBe(2);
    const payload = toImportPayload(data);
    expect(payload.staff[1]).toEqual({
      name: "Tom",
      role: "coach",
      team: "U17",
      team_role: "head_coach",
    });
    expect(payload.teams[0]!.age_category).toBe("senioren");
  });

  it("marks wrong rows", () => {
    const data = ok(
      parseClubImport(
        sheets(
          [["Club", "", "", "", "geen-mail", "", "blauw", ""]],
          [
            ["A", "Veteranen", "", "", ""],
            ["a", "U17", "", "", ""],
          ],
          [
            ["", "Coach", "", ""],
            ["Tom", "Speler", "", ""],
            ["Lien", "Coach", "Onbekend", "Hoofdtrainer"],
            ["Piet", "Coach", "A", "Coördinator"],
            ["Els", "Coach", "", "Hoofdtrainer"],
          ],
        ),
      ),
    );
    expect(data.clubErrors).toHaveLength(2);
    expect(data.teams[0]!.errors).toEqual([
      messages.clubAdmin.excel.errors.ageCategory,
    ]);
    expect(data.teams[1]!.errors).toEqual([
      messages.clubAdmin.excel.errors.duplicateTeam,
    ]);
    expect(data.staff.map((s) => s.errors.length)).toEqual([1, 1, 1, 1, 1]);
    expect(data.staff[3]!.errors).toEqual([
      messages.clubAdmin.excel.errors.teamRoleMismatch,
    ]);
  });

  it("accepts a team that already exists in the club", () => {
    const data = ok(
      parseClubImport(
        sheets([], [], [["Tom", "Coach", "B-ploeg", "Hoofdtrainer"]]),
        ["B-ploeg"],
      ),
    );
    expect(data.staff[0]!.errors).toEqual([]);
  });

  it("refuses a sheet without the columns of the template", () => {
    const result = parseClubImport({ club: [["iets"]], teams: [], staff: [] });
    expect("error" in result).toBe(true);
  });
});
