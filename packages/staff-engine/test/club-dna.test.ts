import { describe, expect, it } from "vitest";

import { clubDnaContext, parseClubDnaQuestionnaire, readClubDna, validateClubDna } from "../src/shared/club-dna";
import type { FormationCatalog } from "../src/shared/formations";

const formations = { versie: "1", formaties: [{ code: "4-3-3", naam: "4-3-3", posten: [] }] } as unknown as FormationCatalog;

const questionnaire = {
  versie: "1",
  themas: [
    {
      id: "balbezit",
      titel: "Balbezit",
      vragen: [
        { id: "principes", vraag: "Principes?", type: "tekst" },
        { id: "opbouw", vraag: "Opbouw?", type: "schaal", min: 1, max: 5 },
      ],
    },
    { id: "formaties", titel: "Formaties", vragen: [{ id: "basis", vraag: "Basis?", type: "formatie" }] },
  ],
  leeftijdsdoelen: { titel: "Doelen", vragen: [{ id: "doelen", vraag: "Doelen", type: "tekst" }] },
};

describe("club DNA", () => {
  it("parses the questionnaire and refuses duplicate age-goal questions", () => {
    expect(parseClubDnaQuestionnaire(questionnaire).value).not.toBeNull();
    const dup = {
      ...questionnaire,
      leeftijdsdoelen: { titel: "D", vragen: [questionnaire.leeftijdsdoelen.vragen[0], questionnaire.leeftijdsdoelen.vragen[0]] },
    };
    expect(parseClubDnaQuestionnaire(dup).issues[0]?.message).toContain("dubbel");
  });

  it("validates answers, levels and age goals", () => {
    const q = parseClubDnaQuestionnaire(questionnaire).value!;
    const { content, errors } = validateClubDna(
      q,
      formations,
      ["u17", "senioren"],
      {
        "balbezit.principes": ["Breed en diep"],
        "niveau:balbezit.principes": "verplicht",
        "balbezit.opbouw": "9",
        "formaties.basis": "4-3-3",
        "niveau:onbekend.x": "verplicht",
        "doel:u17.doelen": "Leren aanbieden",
        "doel:veteranen.doelen": "genegeerd",
      },
      "  Aanvallend voetbal  ",
    );
    expect(errors).toEqual({ "balbezit.opbouw": "out_of_range" });
    expect(content.samenvatting).toBe("Aanvallend voetbal");
    expect(content.antwoorden).toEqual({ "balbezit.principes": "Breed en diep", "formaties.basis": "4-3-3" });
    expect(content.niveaus).toEqual({ "balbezit.principes": "verplicht", "formaties.basis": "aanbevolen" });
    expect(content.leeftijdsdoelen).toEqual({ "u17.doelen": "Leren aanbieden" });
  });

  it("builds the context of one team: principles by level and the goals of its category only", () => {
    const q = parseClubDnaQuestionnaire(questionnaire).value!;
    const content = readClubDna({
      versie: "1",
      samenvatting: "Aanvallend",
      antwoorden: { "balbezit.principes": "Breed", "formaties.basis": "4-3-3", "balbezit.opbouw": 2 },
      niveaus: { "balbezit.principes": "verplicht", "balbezit.opbouw": "fout" },
      leeftijdsdoelen: { "u17.doelen": "Aanbieden", "u15.doelen": "Andere categorie" },
    });
    const context = clubDnaContext(q, content, { club: "Club X", version: 3, category: "u17" });
    expect(context.verplicht).toEqual([{ thema: "Balbezit", vraag: "Principes?", antwoord: "Breed" }]);
    expect(context.aanbevolen.map((p) => p.vraag)).toEqual(["Opbouw?", "Basis?"]);
    expect(context.doelen).toEqual([{ vraag: "Doelen", antwoord: "Aanbieden" }]);
    expect(context.versie).toBe(3);
  });

  it("reads malformed stored content safely", () => {
    expect(readClubDna(null)).toEqual({ versie: "", samenvatting: null, antwoorden: {}, niveaus: {}, leeftijdsdoelen: {} });
  });
});
