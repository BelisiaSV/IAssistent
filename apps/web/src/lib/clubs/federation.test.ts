import { describe, expect, it } from "vitest";

import { clubName, federationClubs } from "./federation";

describe("clubName", () => {
  it("takes the words the teams share", () => {
    expect(clubName(["Belisia Bilzen SV A", "Belisia Bilzen SV B"])).toBe(
      "Belisia Bilzen SV",
    );
  });
  it("drops the team letter of a single team", () => {
    expect(clubName(["KFC Ander A"])).toBe("KFC Ander");
    expect(clubName(["Sporting Hasselt"])).toBe("Sporting Hasselt");
    expect(clubName(["VV Zonhoven U17"])).toBe("VV Zonhoven");
  });
  it("falls back to the first team when they share too little", () => {
    expect(clubName(["A Team", "B Team"])).toBe("A Team");
  });
});

describe("federationClubs", () => {
  it("groups teams by registration number with their divisions", () => {
    const clubs = federationClubs([
      {
        division: "3B",
        home: "Belisia Bilzen SV A",
        away: "Ander FC",
        home_club: "00042",
        away_club: "00077",
      },
      {
        division: "4C",
        home: "Derde VV",
        away: "Belisia Bilzen SV B",
        home_club: "00099",
        away_club: "00042",
      },
      {
        division: "3B",
        home: "Ander FC",
        away: "Belisia Bilzen SV A",
        home_club: "00077",
        away_club: "00042",
      },
      {
        division: "3B",
        home: "Zonder nummer",
        away: "Ander FC",
        home_club: null,
        away_club: "00077",
      },
    ]);
    expect(clubs.map((c) => c.number)).toEqual(["00077", "00042", "00099"]);
    const belisia = clubs.find((c) => c.number === "00042")!;
    expect(belisia.name).toBe("Belisia Bilzen SV");
    expect(belisia.teams).toEqual([
      { name: "Belisia Bilzen SV A", divisions: ["3B"] },
      { name: "Belisia Bilzen SV B", divisions: ["4C"] },
    ]);
  });
});
