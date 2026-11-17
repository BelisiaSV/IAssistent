import { describe, expect, it } from "vitest";

import { parseBank } from "./import";

const exercise = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  nummer: "OEF-007",
  titel: "Positiespel door de linie",
  type: "Positiespel",
  spelfase: "Balbezit",
  doelgroep: "Seniors",
  hoofddoel: "Door de linie spelen",
  organisatie: ["2 vakken"],
  verloop: ["Blauw circuleert"],
  coachingspunten: ["Waar staat de vrije man?"],
  tags: ["positiespel"],
  principes: ["Linies doorbreken"],
  diagram: "abc",
  diagram_type: "video",
  regels: "",
  zones: [4, 5],
  notities: [],
  ...over,
});

describe("parseBank", () => {
  it("reads an exercise and keeps the content", () => {
    const result = parseBank([exercise()])!;
    expect(result.issues).toEqual([]);
    expect(result.exercises[0]).toMatchObject({
      number: "OEF-007",
      source_id: "o1",
      title: "Positiespel door de linie",
      kind: "Positiespel",
      phase: "Balbezit",
      media_kind: "video",
      media_key: "abc",
      tags: ["positiespel"],
    });
    expect(result.exercises[0]!.content.organisatie).toEqual(["2 vakken"]);
    expect(result.exercises[0]!.content).not.toHaveProperty("diagram");
  });

  it("flags open question marks, not coaching questions", () => {
    expect(parseBank([exercise()])!.uncertain).toEqual([]);
    expect(parseBank([exercise({ regels: "?" })])!.uncertain).toEqual([
      "OEF-007",
    ]);
    expect(
      parseBank([exercise({ verloop: ["Verder uitspelen ?"] })])!.uncertain,
    ).toEqual(["OEF-007"]);
  });

  it("reports invalid and duplicate exercises", () => {
    const result = parseBank([
      exercise(),
      exercise({ titel: "Ander" }),
      exercise({ nummer: "zeven" }),
    ])!;
    expect(result.exercises).toHaveLength(1);
    expect(result.issues).toEqual([
      { position: 2, label: "OEF-007 Ander", field: "nummer", duplicate: true },
      {
        position: 3,
        label: "zeven Positiespel door de linie",
        field: "nummer",
      },
    ]);
  });

  it("accepts a backup object with a list and rejects anything else", () => {
    expect(parseBank({ oefeningen: [exercise()] })!.exercises).toHaveLength(1);
    expect(parseBank({})).toBeNull();
    expect(parseBank([])).toBeNull();
  });
});
