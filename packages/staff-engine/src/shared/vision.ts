import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import type { FormationCatalog } from "./formations";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";

const FILE = `${SHARED_DIR}/${SHARED_FILES.vision}`;

export const VISION_SHORT_MAX = 200;
export const VISION_TEXT_MAX = 2000;

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, "id: kleine letters, cijfers en _");
const base = { id, vraag: z.string().min(1), uitleg: z.string().optional() };
const options = z.array(z.string().min(1)).min(2);

const question = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("kort_antwoord"), max_lengte: z.int().min(1).max(VISION_SHORT_MAX).optional() }),
  z.object({ ...base, type: z.literal("tekst"), max_lengte: z.int().min(1).max(VISION_TEXT_MAX).optional() }),
  z.object({ ...base, type: z.literal("keuze"), opties: options }),
  z.object({ ...base, type: z.literal("meerkeuze"), opties: options }),
  z.object({
    ...base,
    type: z.literal("schaal"),
    min: z.int(),
    max: z.int(),
    label_min: z.string().optional(),
    label_max: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("formatie"), meerdere: z.boolean().optional() }),
]);

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  themas: z
    .array(
      z.object({
        id,
        titel: z.string().min(1),
        uitleg: z.string().optional(),
        vragen: z.array(question).min(1),
      }),
    )
    .min(1),
});

export type VisionQuestionnaire = z.infer<typeof schema>;
export type VisionTheme = VisionQuestionnaire["themas"][number];
export type VisionQuestion = VisionTheme["vragen"][number];

/** Validates _gedeeld/visieprofiel.json. */
export function parseVisionQuestionnaire(data: unknown): ParseResult<VisionQuestionnaire> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const q = parsed.value;

  const errors = duplicates(q.themas.map((t) => t.id)).map((t) => `thema "${t}" komt dubbel voor`);
  for (const theme of q.themas) {
    for (const dup of duplicates(theme.vragen.map((v) => v.id))) {
      errors.push(`thema "${theme.id}": vraag "${dup}" komt dubbel voor`);
    }
    for (const vraag of theme.vragen) {
      if ((vraag.type === "keuze" || vraag.type === "meerkeuze") && duplicates(vraag.opties).length) {
        errors.push(`vraag "${theme.id}.${vraag.id}": opties komen dubbel voor`);
      }
      if (vraag.type === "schaal" && vraag.min >= vraag.max) {
        errors.push(`vraag "${theme.id}.${vraag.id}": min moet kleiner zijn dan max`);
      }
    }
  }
  return errors.length ? fail(FILE, errors) : parsed;
}

// --- Answers -------------------------------------------------------------------

export type VisionAnswer = string | string[] | number;
export type VisionAnswers = Record<string, VisionAnswer>;
export type VisionAnswerError = "too_long" | "invalid_option" | "out_of_range" | "invalid";

export function visionAnswerKey(themeId: string, questionId: string) {
  return `${themeId}.${questionId}`;
}

export function maxLength(question: VisionQuestion): number | null {
  if (question.type === "kort_antwoord") return question.max_lengte ?? VISION_SHORT_MAX;
  if (question.type === "tekst") return question.max_lengte ?? VISION_TEXT_MAX;
  return null;
}

/**
 * Checks raw answers (strings or string arrays, e.g. from a form) against the
 * questionnaire. Empty answers are left out; unknown keys are ignored.
 */
export function validateVisionAnswers(
  questionnaire: VisionQuestionnaire,
  formations: FormationCatalog,
  input: Record<string, unknown>,
): { answers: VisionAnswers; errors: Record<string, VisionAnswerError> } {
  const answers: VisionAnswers = {};
  const errors: Record<string, VisionAnswerError> = {};
  const formationCodes = formations.formaties.map((f) => f.code);

  for (const theme of questionnaire.themas) {
    for (const question of theme.vragen) {
      const key = visionAnswerKey(theme.id, question.id);
      const raw = input[key];
      const values = (Array.isArray(raw) ? raw : raw === undefined ? [] : [raw])
        .map((v) => (typeof v === "number" ? String(v) : v))
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v !== "");
      if (values.length === 0) continue;

      const multiple =
        question.type === "meerkeuze" || (question.type === "formatie" && question.meerdere === true);
      if (!multiple && values.length > 1) {
        errors[key] = "invalid";
        continue;
      }
      const value = values[0]!;

      switch (question.type) {
        case "kort_antwoord":
        case "tekst":
          if (value.length > maxLength(question)!) errors[key] = "too_long";
          else answers[key] = value;
          break;
        case "keuze":
        case "meerkeuze":
        case "formatie": {
          const allowed = question.type === "formatie" ? formationCodes : question.opties;
          if (values.some((v) => !allowed.includes(v))) errors[key] = "invalid_option";
          else answers[key] = multiple ? [...new Set(values)] : value;
          break;
        }
        case "schaal": {
          const n = Number(value);
          if (!Number.isInteger(n) || n < question.min || n > question.max) errors[key] = "out_of_range";
          else answers[key] = n;
          break;
        }
      }
    }
  }
  return { answers, errors };
}
