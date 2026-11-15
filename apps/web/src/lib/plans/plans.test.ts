import { describe, expect, it } from "vitest";

import { messages } from "@/lib/messages";

import { formatPrice, parsePrice, planFromForm, planRow, priceInput } from "./plans";

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("plans", () => {
  it("formats and parses prices in euro", () => {
    expect(formatPrice(1995)).toBe("€ 19,95");
    expect(formatPrice(39900)).toBe("€ 399");
    expect(parsePrice("19,95")).toBe(1995);
    expect(parsePrice("€ 1.199")).toBe(119900);
    expect(parsePrice("399")).toBe(39900);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("gratis")).toBeUndefined();
    expect(priceInput(1995)).toBe("19,95");
    expect(priceInput(39900)).toBe("399");
  });

  it("reads the admin form into a plan row", () => {
    const parsed = planFromForm(
      form({
        code: " Coach-Pro ",
        name: "Coach Pro",
        audience: "individual",
        description: "",
        price: "19,95",
        billingPeriod: "month",
        yearlyPrice: "199",
        maxCoaches: "1",
        maxTeams: "",
        features: "Visie\n\nPlanning \n",
        recommended: "on",
        active: "on",
        sortOrder: "10",
      }),
    );
    if (!parsed.success) throw new Error(parsed.error.message);
    expect(planRow(parsed.data)).toMatchObject({
      code: "coach-pro",
      description: null,
      price_cents: 1995,
      yearly_price_cents: 19900,
      max_coaches: 1,
      max_teams: null,
      features: ["Visie", "Planning"],
      recommended: true,
      active: true,
      sort_order: 10,
    });
  });

  it("refuses a wrong price, code or limit and drops the yearly price of a yearly plan", () => {
    const base = { code: "club", name: "Club", audience: "club", price: "399", billingPeriod: "year", yearlyPrice: "100", maxCoaches: "", maxTeams: "", features: "", sortOrder: "" };
    const bad = planFromForm(form({ ...base, price: "veel", code: "Met spatie", maxCoaches: "0" }));
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([messages.plans.errors.price, messages.plans.errors.code, messages.plans.errors.limit]),
    );
    const ok = planFromForm(form(base));
    if (!ok.success) throw new Error(ok.error.message);
    expect(planRow(ok.data)).toMatchObject({ yearly_price_cents: null, active: false, recommended: false, sort_order: 0 });
  });
});
