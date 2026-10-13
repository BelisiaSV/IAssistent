import { describe, expect, it } from "vitest";

import {
  type FormationCatalog,
  parseVisionQuestionnaire,
  validateVisionAnswers,
  type VisionQuestionnaire,
} from "../src/content";

const formations: FormationCatalog = {
  versie: "0.1.0",
  formaties: [
    { code: "4-4-2", naam: "4-4-2", posten: [{ id: "GK", positie: "GK", x: 50, y: 90 }] },
    { code: "4-3-3", naam: "4-3-3", posten: [{ id: "GK", positie: "GK", x: 50, y: 90 }] },
  ],
};

const questionnaire: VisionQuestionnaire = {
  versie: "0.1.0",
  themas: [
    {
      id: "spel",
      titel: "Spel",
      vragen: [
        { id: "zin", vraag: "Zin", type: "kort_antwoord", max_lengte: 10 },
        { id: "uitleg", vraag: "Uitleg", type: "tekst" },
        { id: "blok", vraag: "Blok", type: "keuze", opties: ["Hoog", "Laag"] },
        { id: "kansen", vraag: "Kansen", type: "meerkeuze", opties: ["A", "B", "C"] },
        { id: "druk", vraag: "Druk", type: "schaal", min: 1, max: 5 },
        { id: "formatie", vraag: "Formatie", type: "formatie" },
        { id: "andere", vraag: "Andere", type: "formatie", meerdere: true },
      ],
    },
  ],
};

describe("parseVisionQuestionnaire", () => {
  it("accepts a valid questionnaire", () => {
    expect(parseVisionQuestionnaire(questionnaire).issues).toEqual([]);
  });

  it("reports duplicate ids, duplicate options, a bad scale and unknown types", () => {
    const bad = {
      versie: "1",
      themas: [
        {
          id: "spel",
          titel: "Spel",
          vragen: [
            { id: "a", vraag: "A", type: "keuze", opties: ["X", "X"] },
            { id: "a", vraag: "B", type: "schaal", min: 5, max: 1 },
          ],
        },
      ],
    };
    const messages = parseVisionQuestionnaire(bad).issues.map((i) => i.message);
    expect(messages).toContain('thema "spel": vraag "a" komt dubbel voor');
    expect(messages).toContain('vraag "spel.a": opties komen dubbel voor');
    expect(messages).toContain('vraag "spel.a": min moet kleiner zijn dan max');

    const unknownType = { versie: "1", themas: [{ id: "x", titel: "X", vragen: [{ id: "a", vraag: "A", type: "foto" }] }] };
    expect(parseVisionQuestionnaire(unknownType).issues).not.toEqual([]);
  });
});

describe("validateVisionAnswers", () => {
  it("keeps valid answers, normalises types and leaves out empty ones", () => {
    const { answers, errors } = validateVisionAnswers(questionnaire, formations, {
      "spel.zin": " Kort ",
      "spel.uitleg": "",
      "spel.blok": "Hoog",
      "spel.kansen": ["A", "C", "A"],
      "spel.druk": "4",
      "spel.formatie": "4-4-2",
      "spel.andere": ["4-3-3"],
      "onbekend.vraag": "genegeerd",
    });
    expect(errors).toEqual({});
    expect(answers).toEqual({
      "spel.zin": "Kort",
      "spel.blok": "Hoog",
      "spel.kansen": ["A", "C"],
      "spel.druk": 4,
      "spel.formatie": "4-4-2",
      "spel.andere": ["4-3-3"],
    });
  });

  it("reports invalid answers per question", () => {
    const { answers, errors } = validateVisionAnswers(questionnaire, formations, {
      "spel.zin": "veel te lange tekst",
      "spel.blok": "Midden",
      "spel.druk": "9",
      "spel.formatie": ["4-4-2", "4-3-3"],
      "spel.andere": ["3-5-2"],
    });
    expect(answers).toEqual({});
    expect(errors).toEqual({
      "spel.zin": "too_long",
      "spel.blok": "invalid_option",
      "spel.druk": "out_of_range",
      "spel.formatie": "invalid",
      "spel.andere": "invalid_option",
    });
  });
});
