import { describe, expect, it } from "vitest";

import { withoutNames } from "./names";

const players = [
  { shirt_number: 7, first_name: "Thijn", last_name: "Schoenmakers" },
  { shirt_number: 18, first_name: "Mathijs", last_name: "Bel" },
  { shirt_number: null, first_name: "Jens", last_name: "Senders" },
];

describe("withoutNames", () => {
  it("replaces full and single names with the shirt number", () => {
    expect(withoutNames("Maak een videoanalyse van thijn schoenmakers", players, "een speler")).toBe("Maak een videoanalyse van #7");
    expect(withoutNames("Schoenmakers en Bel spelen links", players, "een speler")).toBe("#7 en #18 spelen links");
    expect(withoutNames("Gesprek met Senders Jens", players, "een speler")).toBe("Gesprek met een speler");
  });

  it("leaves ordinary words alone", () => {
    expect(withoutNames("bel de dokter over de belasting", players, "een speler")).toBe("bel de dokter over de belasting");
  });
});
