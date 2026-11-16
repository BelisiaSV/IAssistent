import { describe, expect, it } from "vitest";

import { decodeExport, exportKind, forDivisions, parseExport, teamDivisions } from "./parse";

const results = [
  "DIV;DATE;HOUR;HOME;AWAY;RH;RA;STATUS;MD;REGNUMBERHOME;REGNUMBERAWAY",
  "1;22/11/2026;15:00;Belisia Bilzen SV A;Oud-Heverlee Leuven B;;;;13;00232;00018",
  "1;15/11/2026;15:00;KFC Merelbeke ;Belisia Bilzen SV A;1;2;;12;03551;00232",
  "L4E;15/11/2026;14:30;Sporting Calcio Genk ;K.V.V. Vlug & Vrij Stokkem B;;;PP;12;09581;00332",
  "RV8H;02/10/2026;10:00;KFC Evergem Center ;FC Orly Sint Niklaas ;;;;1;1;2",
  "RV8H;02/10/2026;11:00;KFC Evergem Center ;FC Orly Sint Niklaas ;;;;1;1;2",
].join("\r\n");
const standings = ["DIV;POS;TEAM;M;W;L;D;G+;G-;PTS;PER", "1;6;Belisia Bilzen SV A;12;6;4;2;23;19;20;0", "1;1;FC Mandel United Izegem ;12;8;3;1;23;12;25;1"].join("\n");
const referees = [
  "DIV;DATE;HOUR;HOME;AWAY;STATUS;REFEREE;ASSISTANT-REFEREE1;ASSISTANT-REFEREE2;4THOFFICIAL;TYPE",
  "1;22/11/2026;15:00;Belisia Bilzen SV A;Oud-Heverlee Leuven B;;Krieken Jan;CRC;CRC;;CHP",
].join("\n");

describe("competition exports", () => {
  it("recognises the three exports by their header", () => {
    expect([results, standings, referees, "a;b"].map(exportKind)).toEqual(["results", "standings", "referees", null]);
  });

  it("reads results, trims names and keeps a match once", () => {
    const parsed = parseExport(results)!;
    expect(parsed.kind).toBe("results");
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0]).toMatchObject({ division: "1", date: "2026-11-22", kickoff: "15:00", home: "Belisia Bilzen SV A", home_goals: null, matchday: 13, home_club: "00232" });
    expect(parsed.rows[1]).toMatchObject({ home: "KFC Merelbeke", home_goals: 1, away_goals: 2, status: null });
    expect(parsed.rows[2]).toMatchObject({ status: "PP" });
    expect(parsed.rows[3]).toMatchObject({ kickoff: "11:00" });
  });

  it("reads standings with their period and referee assignments", () => {
    expect(parseExport(standings)!.rows[1]).toMatchObject({ team: "FC Mandel United Izegem", position: 1, points: 25, period: 1 });
    expect(parseExport(referees)!.rows[0]).toMatchObject({ referee: "Krieken Jan", assistant_1: "CRC", fourth_official: null, match_type: "CHP" });
  });

  it("lists every team with its divisions and filters on linked divisions", () => {
    const all = [parseExport(results)!, parseExport(standings)!];
    expect(Object.fromEntries(teamDivisions(all).get("Belisia Bilzen SV A")!)).toEqual({ "1": 2 });
    expect(forDivisions(all[0]!.rows as { division: string }[], new Set(["1"]))).toHaveLength(2);
  });

  it("decodes the referee file in Windows-1252", () => {
    const bytes = new Uint8Array([0x4d, 0xe9, 0x6c, 0x61]).buffer;
    expect(decodeExport(bytes)).toBe("Méla");
  });
});
