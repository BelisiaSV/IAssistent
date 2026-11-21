import { QUALITY_TASK, SHARED_TEXT_FILES } from "./layout";
import { validateOutput } from "./output";
import { renderTemplate, roleTask, sharedText } from "./prompt";
import { type GenerateResult, StaffGenerationError, type StaffModelProvider } from "./providers/types";
import { qualityVerdict } from "./shared/quality";
import type { Staff } from "./types";

/**
 * Training Quality Engine: a role (kwaliteit.json `rol`) checks the week
 * proposal of the staff against the criteria in /staff. Keys are Dutch
 * because this data goes to the AI as-is. No names of players or opponents.
 */
export interface QualityInput {
  /** The coach's vision and, for a club team, the club DNA (`club`). */
  visie: unknown;
  /** The week as entered: days, MD labels, week type, week note. */
  weekinput: unknown;
  /** Squad without names. */
  kern: unknown;
  /** The proposal per role, plus the coach's feedback on this version. */
  voorstel: Record<string, unknown>;
}

export interface QualityOutput {
  samenvatting: string;
  criteria: { code: string; score: number; toelichting: string }[];
  sterke_punten: string[];
  verbeterpunten: { criterium: string; punt: string }[];
}

export interface QualityResult extends Omit<GenerateResult, "output"> {
  output: QualityOutput;
  /** Average of the scores, one decimal. */
  average: number;
  /** Verdict code from kwaliteit.json (e.g. "goed"). */
  verdict: string;
  contentVersion: string;
}

/** Runs the quality check of a week proposal and checks that every criterion got exactly one score. */
export async function runQualityCheck(staff: Staff, input: QualityInput, provider: StaffModelProvider): Promise<QualityResult> {
  const criteria = staff.quality;
  const role = staff.roles.find((r) => r.id === criteria.rol);
  const task = role ? roleTask(role, QUALITY_TASK) : null;
  if (!role || !task) throw new StaffGenerationError("role_not_ready", `role ${criteria.rol} cannot check quality`);

  const example = task.examples.find((f) => f.path.endsWith(".json"));
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.qualitySystemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    rol: role.description.trim(),
    instructies: task.instructions.trim(),
    criteria: JSON.stringify({ schaal: criteria.schaal, criteria: criteria.criteria }, null, 2),
    voorbeeld: example ? example.content.trim() : "null",
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.qualityUserTemplate), {
    visie: JSON.stringify(input.visie, null, 2),
    weekinput: JSON.stringify(input.weekinput, null, 2),
    kern: JSON.stringify(input.kern, null, 2),
    voorstel: JSON.stringify(input.voorstel, null, 2),
  });

  const result = await provider.generate({
    staff,
    role,
    task: task.id,
    outputSchema: task.outputSchema,
    system,
    user,
    context: input,
  });
  const validation = validateOutput(task.outputSchema, result.output);
  if (!validation.ok) {
    throw new StaffGenerationError("invalid_output", "output does not match output-schema.json", validation.errors);
  }
  const output = result.output as QualityOutput;
  const problems = qualityProblems(staff, output);
  if (problems.length) throw new StaffGenerationError("invalid_output", "scores do not match the criteria", problems);
  const average = Math.round((output.criteria.reduce((sum, c) => sum + c.score, 0) / output.criteria.length) * 10) / 10;
  return {
    output,
    average,
    verdict: qualityVerdict(criteria, average).code,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    contentVersion: `${role.meta.versie}+${criteria.versie}`,
  };
}

/** Every criterion exactly once, scores on the scale, improvement points about known criteria. */
export function qualityProblems(staff: Staff, output: QualityOutput): string[] {
  const { criteria, schaal } = staff.quality;
  const codes = criteria.map((c) => c.code);
  const problems: string[] = [];
  for (const code of codes) {
    const n = output.criteria.filter((c) => c.code === code).length;
    if (n !== 1) problems.push(`criterium ${code}: ${n} scores`);
  }
  for (const c of output.criteria) {
    if (!codes.includes(c.code)) problems.push(`onbekend criterium ${c.code}`);
    if (c.score < schaal.min || c.score > schaal.max) problems.push(`criterium ${c.code}: score buiten de schaal`);
  }
  for (const v of output.verbeterpunten) {
    if (!codes.includes(v.criterium)) problems.push(`verbeterpunt bij onbekend criterium ${v.criterium}`);
  }
  return problems;
}
