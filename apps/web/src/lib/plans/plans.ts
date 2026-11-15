import type { Tables } from "@iassistent/db";
import { z } from "zod";

import { messages } from "@/lib/messages";

const e = messages.plans.errors;

export type Plan = Tables<"plans">;
export const AUDIENCES = ["individual", "club"] as const;
export const BILLING_PERIODS = ["month", "year"] as const;
export const MAX_FEATURES = 20;

const euro = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });

/** 1995 → "€ 19,95"; whole euros without decimals (39900 → "€ 399"). */
export function formatPrice(cents: number): string {
  const text = euro.format(cents / 100).replace(/\u00a0/g, " ");
  return cents % 100 === 0 ? text.replace(/,00$/, "") : text;
}

/** "19,95", "19.95", "€ 1.199" or "399" → cents; "" → null. Undefined when not a price. */
export function parsePrice(text: string): number | null | undefined {
  let t = text.replace(/[€\s\u00a0]/g, "");
  // A comma is the decimal sign; dots before it, or in groups of three, separate thousands.
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
}

/** Cents → the value of a price field (1995 → "19,95"). */
export function priceInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "");
}

/** Features of a plan from its JSON column. */
export function planFeatures(plan: Pick<Plan, "features">): string[] {
  return Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === "string") : [];
}

const price = z.string().transform((v, ctx) => {
  const cents = parsePrice(v);
  if (cents === undefined) {
    ctx.addIssue({ code: "custom", message: e.price });
    return z.NEVER;
  }
  return cents;
});
const limit = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      ctx.addIssue({ code: "custom", message: e.limit });
      return z.NEVER;
    }
    return n;
  });

/** The plan form of the admins (all fields as strings from FormData). */
export const planInputSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, e.code),
  name: z.string().trim().min(1, e.name).max(60, e.name),
  audience: z.enum(AUDIENCES, e.audience),
  description: z
    .string()
    .trim()
    .max(300, e.tooLong)
    .transform((v) => v || null),
  price,
  billingPeriod: z.enum(BILLING_PERIODS, e.billing),
  yearlyPrice: price,
  maxCoaches: limit,
  maxTeams: limit,
  features: z
    .string()
    .transform((v) => v.split("\n").map((l) => l.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(120, e.tooLong)).max(MAX_FEATURES, e.features)),
  recommended: z.boolean(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(e.sortOrder).min(0, e.sortOrder).max(1000, e.sortOrder),
});
export type PlanInput = z.infer<typeof planInputSchema>;

export function planFromForm(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  return planInputSchema.safeParse({
    code: text("code"),
    name: text("name"),
    audience: text("audience"),
    description: text("description"),
    price: text("price"),
    billingPeriod: text("billingPeriod"),
    yearlyPrice: text("yearlyPrice"),
    maxCoaches: text("maxCoaches"),
    maxTeams: text("maxTeams"),
    features: text("features"),
    recommended: formData.get("recommended") === "on",
    active: formData.get("active") === "on",
    sortOrder: text("sortOrder") || "0",
  });
}

/** A validated plan as a row for the plans table. */
export function planRow(p: PlanInput) {
  return {
    code: p.code,
    name: p.name,
    audience: p.audience,
    description: p.description,
    price_cents: p.price,
    billing_period: p.billingPeriod,
    yearly_price_cents: p.billingPeriod === "month" ? p.yearlyPrice : null,
    max_coaches: p.maxCoaches,
    max_teams: p.maxTeams,
    features: p.features,
    recommended: p.recommended,
    active: p.active,
    sort_order: p.sortOrder,
  };
}
