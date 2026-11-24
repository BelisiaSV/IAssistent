import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import {
  type ClubFile,
  hasErrors,
  parseClubFile,
  PEOPLE_COLUMNS,
  seatsNeeded,
  TEAM_COLUMNS,
  toFilePayload,
} from "./import";

const f = messages.clubPeople.file;
const col = f.columns;
const header = (cols: readonly (keyof typeof col)[]) => cols.map((c) => col[c]);

function sheets(teams: string[][], people: string[][]) {
  return {
    teams: [header(TEAM_COLUMNS), ...teams],
    people: [header(PEOPLE_COLUMNS), ...people],
  };
}

function ok(result: ReturnType<typeof parseClubFile>): ClubFile {
  if ("error" in result) throw new Error(result.error);
  return result;
}

const roles = messages.clubPeople.roles;

describe("parseClubFile", () => {
  it("reads teams and people with labels from the lists", () => {
    const data = ok(
      parseClubFile(
        sheets(
          [
            ["Eerste ploeg", "Senioren", "belisia bilzen sv a"],
            ["U15", "U15", ""],
          ],
          [
            ["Tom", " Tom@Club.be ", roles.head_coach!, "Eerste ploeg"],
            ["Tom", "tom@club.be", roles.assistant_coach!, "U15"],
            ["Ann", "ann@club.be", roles.club_manager!, ""],
            ["Piet", "piet@club.be", roles.technical_director!, ""],
          ],
        ),
        [],
        ["Belisia Bilzen SV A"],
      ),
    );
    expect(hasErrors(data)).toBe(false);
    expect(data.teams[0]).toMatchObject({ category: "senioren", federationTeam: "Belisia Bilzen SV A" });
    expect(data.people[0]).toMatchObject({ email: "tom@club.be", role: "head_coach" });
    // Tom needs one licence, Piet one; the club manager none.
    expect(seatsNeeded(data.people)).toBe(2);
    expect(seatsNeeded(data.people, ["piet@club.be"])).toBe(1);
    expect(toFilePayload(data).people[2]).toEqual({ name: "Ann", email: "ann@club.be", role: "club_manager", team: "" });
  });

  it("marks errors per row", () => {
    const data = ok(
      parseClubFile(
        sheets(
          [
            ["U15", "Iets", "Onbekende ploeg"],
            ["u15", "U15", ""],
          ],
          [
            ["X", "geen-mail", roles.head_coach!, ""],
            ["Y", "y@club.be", "Speler", ""],
            ["Z", "z@club.be", roles.technical_director!, "U15"],
            ["W", "w@club.be", roles.head_coach!, "U21"],
          ],
        ),
      ),
    );
    expect(data.teams[0]!.errors).toEqual([f.errors.category, f.errors.federationTeam]);
    expect(data.teams[1]!.errors).toEqual([f.errors.duplicateTeam]);
    expect(data.people.map((p) => p.errors)).toEqual([
      [f.errors.email],
      [f.errors.role],
      [f.errors.roleWithoutTeam],
      [f.errors.teamUnknown],
    ]);
  });

  it("accepts a team that exists already", () => {
    const data = ok(parseClubFile(sheets([], [["T", "t@club.be", roles.head_coach!, "U17"]]), ["U17"]));
    expect(hasErrors(data)).toBe(false);
  });

  it("reports a missing column", () => {
    const result = parseClubFile({ teams: [["iets"]], people: [] });
    expect(result).toEqual({ error: f.errors.missingColumn(f.sheets.teams, col.teamName) });
  });
});
