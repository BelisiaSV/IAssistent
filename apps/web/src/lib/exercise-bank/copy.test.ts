import { describe, expect, it } from "vitest";

import { bankToExercise } from "./copy";

describe("bankToExercise", () => {
  it("makes an own exercise from a bank exercise", () => {
    const exercise = bankToExercise({
      number: "OEF-007",
      title: "Positiespel door de mannequinlinie",
      kind: "Positiespel",
      phase: "Balbezit",
      target_group: null,
      tags: ["Positiespel", "linies"],
      principles: [],
      content: {
        organisatie: ["2 vakken"],
        veldafmeting: "40 x 30 m",
        materiaal: ["kegels", "ballen"],
        verloop: ["Blauw circuleert"],
        regels: "Twee balcontacten",
        coachingspunten: ["Open lichaamshouding"],
        makkelijker: "Extra neutrale speler",
        moeilijker: "",
      },
    });
    expect(exercise).toEqual({
      title: "Positiespel door de mannequinlinie",
      kind: "exercise",
      labels: ["positiespel", "linies"],
      organisation: "2 vakken\n40 x 30 m\nMateriaal: kegels, ballen",
      course: ["Blauw circuleert", "Twee balcontacten"],
      coaching_points: ["Open lichaamshouding"],
      variations: ["Makkelijker: Extra neutrale speler"],
      bank_number: "OEF-007",
    });
  });
});
