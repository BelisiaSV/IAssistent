import type { BankRow } from "./staff";

/** Text fields of an exercise in the bank's shape (Dutch keys of the bank). */
export const TEXT_FIELDS = [
  "titel",
  "type",
  "spelfase",
  "doelgroep",
  "hoofddoel",
  "aantal_spelers",
  "duur",
  "veldafmeting",
  "belasting",
  "belasting_toelichting",
  "regels",
  "makkelijker",
  "moeilijker",
] as const;
/** Fields with one item per line. */
export const LIST_FIELDS = [
  "subdoelen",
  "principes",
  "organisatie",
  "verloop",
  "coachingspunten",
  "materiaal",
] as const;

/** Fields in the order of the form: [key, kind]. */
export const FORM_FIELDS: [string, "text" | "area" | "lines" | "tags"][] = [
  ["titel", "text"],
  ["type", "text"],
  ["spelfase", "text"],
  ["doelgroep", "text"],
  ["hoofddoel", "area"],
  ["subdoelen", "lines"],
  ["principes", "lines"],
  ["aantal_spelers", "text"],
  ["duur", "text"],
  ["veldafmeting", "text"],
  ["belasting", "text"],
  ["belasting_toelichting", "area"],
  ["organisatie", "lines"],
  ["verloop", "lines"],
  ["regels", "area"],
  ["coachingspunten", "lines"],
  ["makkelijker", "area"],
  ["moeilijker", "area"],
  ["materiaal", "lines"],
  ["tags", "tags"],
];

/** The form's values as an exercise record in the bank's shape (to check with parseBank). */
export function recordFromForm(formData: FormData): Record<string, unknown> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const lines = (key: string) =>
    text(key)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((key) => [key, text(key)])),
    ...Object.fromEntries(LIST_FIELDS.map((key) => [key, lines(key)])),
    tags: text("tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    zones: text("zones")
      .split(",")
      .map(Number)
      .filter((z) => Number.isInteger(z) && z >= 1 && z <= 18),
  };
}

/** An exercise in the bank's shape as the form's starting values. */
export function formValues(
  row: Pick<
    BankRow,
    "title" | "kind" | "phase" | "target_group" | "tags" | "content"
  >,
): Record<string, string> {
  const c = (
    row.content && typeof row.content === "object" ? row.content : {}
  ) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const lines = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").join("\n")
      : "";
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((key) => [key, text(c[key])])),
    ...Object.fromEntries(LIST_FIELDS.map((key) => [key, lines(c[key])])),
    titel: row.title,
    type: row.kind,
    spelfase: row.phase ?? "",
    doelgroep: row.target_group ?? "",
    tags: row.tags.join(", "),
  };
}
