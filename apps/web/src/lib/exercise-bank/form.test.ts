import { describe, expect, it } from "vitest";

import { formValues, recordFromForm } from "./form";
import { parseBank } from "./import";

describe("exercise form", () => {
  it("round-trips: form values back into a record that parseBank accepts", () => {
    const values = formValues({
      title: "Rondo 5v2",
      kind: "Rondo",
      phase: "Balbezit",
      target_group: null,
      tags: ["rondo", "druk"],
      content: { hoofddoel: "Balcirculatie", verloop: ["Stap 1", "Stap 2"], zones: [8] },
    });
    const form = new FormData();
    for (const [k, v] of Object.entries(values)) form.set(k, v);
    form.set("zones", "8,11");
    const record = recordFromForm(form);
    expect(record.verloop).toEqual(["Stap 1", "Stap 2"]);
    expect(record.tags).toEqual(["rondo", "druk"]);
    expect(record.zones).toEqual([8, 11]);
    const parsed = parseBank([{ ...record, nummer: "CLUB-1" }]);
    expect(parsed?.exercises[0]?.title).toBe("Rondo 5v2");
  });
});
