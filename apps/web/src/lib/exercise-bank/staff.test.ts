import { describe, expect, it } from "vitest";

import { bankExercise, type BankRow, rankBank } from "./staff";

const row = (number: string, title: string, over: Partial<BankRow> = {}): BankRow => ({
  number,
  title,
  kind: "Positiespel",
  phase: "Balbezit",
  target_group: null,
  tags: [],
  principles: [],
  content: { hoofddoel: "", organisatie: ["Twee vakken"], coachingspunten: ["Open houding"], notities: [{ tekst: "intern" }] },
  ...over,
});

describe("rankBank", () => {
  const rows = [
    row("OEF-001", "Rondo 4v2"),
    row("OEF-002", "Omschakeling na balverovering", { phase: "Omschakeling V-B" }),
    row("OEF-003", "Afwerking na combinatie", { kind: "Afwerking", tags: ["afwerken"] }),
  ];

  it("puts the best fit first", () => {
    const ranked = rankBank(rows, "Ik wil trainen op omschakelen vanuit een medium blok met afwerking", 3);
    expect(ranked.map((r) => r.number)).toEqual(["OEF-002", "OEF-003", "OEF-001"]);
  });

  it("keeps the order without a question and respects the limit", () => {
    expect(rankBank(rows, "", 2).map((r) => r.number)).toEqual(["OEF-001", "OEF-002"]);
    expect(rankBank(rows, "rondo", 1).map((r) => r.number)).toEqual(["OEF-001"]);
  });
});

describe("bankExercise", () => {
  it("gives the staff the exercise without notes", () => {
    const ex = bankExercise(row("OEF-001", "Rondo 4v2"));
    expect(ex).toMatchObject({ nummer: "OEF-001", titel: "Rondo 4v2", organisatie: ["Twee vakken"], coachingspunten: ["Open houding"], regels: "" });
    expect(ex).not.toHaveProperty("notities");
  });
});
