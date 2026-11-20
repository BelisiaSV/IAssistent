import type { FormationCatalog } from "@iassistent/staff-engine/content";
import { describe, expect, it } from "vitest";

import { answerText } from "./answer-text";

const formations = {
  versie: "1",
  formaties: [{ code: "4-3-3", naam: "4-3-3 aanvallend", posten: [] }],
} as unknown as FormationCatalog;

describe("answerText", () => {
  it("shows formation names, scales with labels and lists", () => {
    expect(
      answerText(
        { id: "f", vraag: "F", type: "formatie", meerdere: true },
        ["4-3-3", "3-5-2"],
        formations,
      ),
    ).toBe("4-3-3 aanvallend, 3-5-2");
    expect(
      answerText(
        {
          id: "s",
          vraag: "S",
          type: "schaal",
          min: 1,
          max: 5,
          label_min: "Kort",
          label_max: "Lang",
        },
        1,
        formations,
      ),
    ).toBe("1 / 5 (Kort)");
    expect(
      answerText(
        { id: "s", vraag: "S", type: "schaal", min: 1, max: 5 },
        3,
        formations,
      ),
    ).toBe("3 / 5");
    expect(
      answerText(
        { id: "m", vraag: "M", type: "meerkeuze", opties: ["a", "b"] },
        ["a", "b"],
        formations,
      ),
    ).toBe("a, b");
  });
});
