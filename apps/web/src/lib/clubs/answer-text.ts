import type {
  FormationCatalog,
  VisionAnswer,
  VisionQuestion,
} from "@iassistent/staff-engine/content";

/** An answer as text: formation names, scale with its labels, lists joined. */
export function answerText(
  question: VisionQuestion,
  answer: VisionAnswer,
  formations: FormationCatalog,
): string {
  const values = Array.isArray(answer) ? answer : [String(answer)];
  if (question.type === "formatie") {
    return values
      .map(
        (code) =>
          formations.formaties.find((f) => f.code === code)?.naam ?? code,
      )
      .join(", ");
  }
  if (question.type === "schaal") {
    const n = Number(values[0]);
    const label =
      n === question.min
        ? question.label_min
        : n === question.max
          ? question.label_max
          : undefined;
    return `${n} / ${question.max}${label ? ` (${label})` : ""}`;
  }
  return values.join(", ");
}
