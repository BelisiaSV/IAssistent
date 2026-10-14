import type { RoleContext } from "./context";
import { SHARED_DIR, SHARED_TEXT_FILES } from "./layout";
import { DEFAULT_TASK } from "./layout";
import type { Staff, StaffFile, StaffRole } from "./types";

/** Placeholders the prompt templates in _gedeeld may use. */
export const TEMPLATE_PLACEHOLDERS = {
  system: ["afspraken", "visie_afspraken", "wedstrijddagen", "periodisering", "rol", "instructies", "referentie", "voorbeeld"],
  user: ["visie", "weekinput", "kern", "tegenstander", "evaluaties", "belastingshistoriek", "testen", "staf", "feedback"],
} as const;

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

export function templatePlaceholders(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]!))];
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`no value for placeholder {{${name}}}`);
    return value;
  });
}

function sharedText(staff: Staff, fileName: string): string {
  const file = staff.shared.find((f) => f.path === `${SHARED_DIR}/${fileName}`);
  if (!file) throw new Error(`missing shared file ${fileName}`);
  return file.content.trim();
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export interface ResolvedTask {
  id: string;
  instructions: string;
  outputSchema: Record<string, unknown>;
  examples: StaffFile[];
}

/** The default task of a role, or one of its extra tasks (taken/<id>). */
export function roleTask(role: StaffRole, taskId: string = DEFAULT_TASK): ResolvedTask | null {
  if (taskId === DEFAULT_TASK) {
    return { id: DEFAULT_TASK, instructions: role.instructions, outputSchema: role.outputSchema, examples: role.examples };
  }
  return role.tasks.find((t) => t.id === taskId) ?? null;
}

/** The example output of a role task (first JSON file in its voorbeelden/), if any. */
export function roleExample(role: StaffRole, taskId: string = DEFAULT_TASK): unknown | null {
  const file = roleTask(role, taskId)?.examples.find((f) => f.path.endsWith(".json"));
  return file ? JSON.parse(file.content) : null;
}

/**
 * Builds the system prompt (stable per role and content version, so it can be
 * cached) and the user prompt (this week's context) from the /staff templates.
 */
export function buildRolePrompt(staff: Staff, role: StaffRole, context: RoleContext, taskId: string = DEFAULT_TASK) {
  const task = roleTask(role, taskId);
  if (!task) throw new Error(`role ${role.id} has no task ${taskId}`);
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.systemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    wedstrijddagen: json(staff.matchDays.dagen),
    periodisering: json({ weektypes: staff.periodization.weektypes, cycli: staff.periodization.cycli, voor_start: staff.periodization.voor_start }),
    rol: role.description.trim(),
    instructies: task.instructions.trim(),
    referentie: role.references.map((f) => `## ${f.path}\n\n${f.content.trim()}`).join("\n\n"),
    voorbeeld: json(roleExample(role, taskId)),
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.userTemplate), {
    visie: json(context.visie),
    weekinput: json(context.weekinput),
    kern: json(context.kern),
    tegenstander: json(context.tegenstander),
    evaluaties: json(context.evaluaties),
    belastingshistoriek: json(context.belastingshistoriek),
    testen: json(context.testen),
    staf: json(Object.keys(context.staf).length ? context.staf : null),
    feedback: json(context.feedback),
  });
  return { system, user };
}
