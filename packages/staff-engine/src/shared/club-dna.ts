import { z } from "zod";

import { SHARED_DIR, SHARED_FILES } from "../layout";
import type { FormationCatalog } from "./formations";
import { duplicates, fail, type ParseResult, parseWith } from "./parse";
import {
  themeErrors,
  validateVisionAnswers,
  type VisionAnswer,
  type VisionAnswerError,
  type VisionAnswers,
  visionAnswerKey,
  visionQuestionSchema,
  type VisionQuestionnaire,
  visionThemeSchema,
} from "./vision";

const FILE = `${SHARED_DIR}/${SHARED_FILES.clubDna}`;

const schema = z.object({
  versie: z.string().min(1),
  uitleg: z.string().optional(),
  themas: z.array(visionThemeSchema).min(1),
  leeftijdsdoelen: z.object({
    titel: z.string().min(1),
    uitleg: z.string().optional(),
    vragen: z.array(visionQuestionSchema).min(1),
  }),
});

export type ClubDnaQuestionnaire = z.infer<typeof schema>;

/** Validates _gedeeld/clubdna.json (same question types as the vision profile). */
export function parseClubDnaQuestionnaire(data: unknown): ParseResult<ClubDnaQuestionnaire> {
  const parsed = parseWith(schema, data, FILE);
  if (!parsed.value) return parsed;
  const errors = [
    ...themeErrors(parsed.value.themas),
    ...duplicates(parsed.value.leeftijdsdoelen.vragen.map((v) => v.id)).map((v) => `leeftijdsdoelen: vraag "${v}" komt dubbel voor`),
  ];
  return errors.length ? fail(FILE, errors) : parsed;
}

/** How binding a club principle is. */
export const CLUB_DNA_LEVELS = ["verplicht", "aanbevolen"] as const;
export type ClubDnaLevel = (typeof CLUB_DNA_LEVELS)[number];

/**
 * The club's answers as stored in the database:
 *   antwoorden       "<thema>.<vraag>" → answer
 *   niveaus          "<thema>.<vraag>" → verplicht | aanbevolen (default aanbevolen)
 *   leeftijdsdoelen  "<categorie>.<vraag>" → answer
 */
export interface ClubDnaContent {
  versie: string;
  samenvatting: string | null;
  antwoorden: VisionAnswers;
  niveaus: Record<string, ClubDnaLevel>;
  leeftijdsdoelen: VisionAnswers;
}

/** The themes as a vision questionnaire, so the answers can be checked the same way. */
function asVision(q: ClubDnaQuestionnaire): VisionQuestionnaire {
  return { versie: q.versie, themas: q.themas };
}

/** The age goals of one category as a vision questionnaire with that category as theme. */
function ageGoals(q: ClubDnaQuestionnaire, category: string): VisionQuestionnaire {
  return { versie: q.versie, themas: [{ id: category, titel: category, vragen: q.leeftijdsdoelen.vragen }] };
}

/**
 * Checks raw form input: answers under "<thema>.<vraag>", levels under
 * "niveau:<thema>.<vraag>", age goals under "doel:<categorie>.<vraag>".
 * Unknown keys are ignored; a level without an answer is dropped.
 */
export function validateClubDna(
  q: ClubDnaQuestionnaire,
  formations: FormationCatalog,
  categories: readonly string[],
  input: Record<string, unknown>,
  summary: string | null,
): { content: ClubDnaContent; errors: Record<string, VisionAnswerError> } {
  const { answers, errors } = validateVisionAnswers(asVision(q), formations, input);
  const niveaus: Record<string, ClubDnaLevel> = {};
  for (const key of Object.keys(answers)) {
    const raw = input[`niveau:${key}`];
    const level = Array.isArray(raw) ? raw[0] : raw;
    niveaus[key] = level === "verplicht" ? "verplicht" : "aanbevolen";
  }
  const leeftijdsdoelen: VisionAnswers = {};
  for (const category of categories) {
    const prefix = `doel:${category}.`;
    const goalsInput = Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => [`${category}.${key.slice(prefix.length)}`, value]),
    );
    const result = validateVisionAnswers(ageGoals(q, category), formations, goalsInput);
    Object.assign(leeftijdsdoelen, result.answers);
    for (const [key, error] of Object.entries(result.errors)) errors[`doel:${key}`] = error;
  }
  return {
    content: { versie: q.versie, samenvatting: summary?.trim() || null, antwoorden: answers, niveaus, leeftijdsdoelen },
    errors,
  };
}

/** Stored content (jsonb) back into its shape; anything malformed is left out. */
export function readClubDna(value: unknown): ClubDnaContent {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const map = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const answers = (x: unknown): VisionAnswers =>
    Object.fromEntries(
      Object.entries(map(x)).filter(
        (e): e is [string, VisionAnswer] =>
          typeof e[1] === "string" || typeof e[1] === "number" || (Array.isArray(e[1]) && e[1].every((i) => typeof i === "string")),
      ),
    );
  return {
    versie: typeof v.versie === "string" ? v.versie : "",
    samenvatting: typeof v.samenvatting === "string" ? v.samenvatting : null,
    antwoorden: answers(v.antwoorden),
    niveaus: Object.fromEntries(
      Object.entries(map(v.niveaus)).filter((e): e is [string, ClubDnaLevel] => e[1] === "verplicht" || e[1] === "aanbevolen"),
    ),
    leeftijdsdoelen: answers(v.leeftijdsdoelen),
  };
}

export interface ClubDnaPrinciple {
  thema: string;
  vraag: string;
  antwoord: VisionAnswer;
}

/** What the staff of a club team gets: the club's principles by level and the goals of its own age category. */
export interface ClubDnaContext {
  club: string;
  versie: number;
  samenvatting: string | null;
  verplicht: ClubDnaPrinciple[];
  aanbevolen: ClubDnaPrinciple[];
  leeftijdscategorie: string;
  doelen: { vraag: string; antwoord: VisionAnswer }[];
}

export function clubDnaContext(
  q: ClubDnaQuestionnaire,
  content: ClubDnaContent,
  input: { club: string; version: number; category: string },
): ClubDnaContext {
  const principles = q.themas.flatMap((theme) =>
    theme.vragen.flatMap((vraag) => {
      const key = visionAnswerKey(theme.id, vraag.id);
      const antwoord = content.antwoorden[key];
      if (antwoord === undefined) return [];
      return [{ level: content.niveaus[key] ?? "aanbevolen", principle: { thema: theme.titel, vraag: vraag.vraag, antwoord } }];
    }),
  );
  return {
    club: input.club,
    versie: input.version,
    samenvatting: content.samenvatting,
    verplicht: principles.filter((p) => p.level === "verplicht").map((p) => p.principle),
    aanbevolen: principles.filter((p) => p.level === "aanbevolen").map((p) => p.principle),
    leeftijdscategorie: input.category,
    doelen: q.leeftijdsdoelen.vragen.flatMap((vraag) => {
      const antwoord = content.leeftijdsdoelen[visionAnswerKey(input.category, vraag.id)];
      return antwoord === undefined ? [] : [{ vraag: vraag.vraag, antwoord }];
    }),
  };
}
