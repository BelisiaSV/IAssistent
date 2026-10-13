import type { RoleContext } from "./context";
import { SHARED_DIR, SHARED_TEXT_FILES } from "./layout";
import type { Staff, StaffRole } from "./types";

/** Placeholders the prompt templates in _gedeeld may use. */
export const TEMPLATE_PLACEHOLDERS = {
  system: ["afspraken", "visie_afspraken", "wedstrijddagen", "periodisering", "rol", "instructies", "referentie", "voorbeeld"],
  user: ["visie", "weekinput", "kern", "belastingshistoriek", "testen", "staf", "feedback"],
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

/** The role's example output (first JSON file in voorbeelden/), if any. */
export function roleExample(role: StaffRole): unknown | null {
  const file = role.examples.find((f) => f.path.endsWith(".json"));
  return file ? JSON.parse(file.content) : null;
}

/**
 * Builds the system prompt (stable per role and content version, so it can be
 * cached) and the user prompt (this week's context) from the /staff templates.
 */
export function buildRolePrompt(staff: Staff, role: StaffRole, context: RoleContext) {
  const system = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.systemTemplate), {
    afspraken: sharedText(staff, SHARED_TEXT_FILES.agreements),
    visie_afspraken: sharedText(staff, SHARED_TEXT_FILES.visionAgreements),
    wedstrijddagen: json(staff.matchDays.dagen),
    periodisering: json({ weektypes: staff.periodization.weektypes, cycli: staff.periodization.cycli, voor_start: staff.periodization.voor_start }),
    rol: role.description.trim(),
    instructies: role.instructions.trim(),
    referentie: role.references.map((f) => `## ${f.path}\n\n${f.content.trim()}`).join("\n\n"),
    voorbeeld: json(roleExample(role)),
  });
  const user = renderTemplate(sharedText(staff, SHARED_TEXT_FILES.userTemplate), {
    visie: json(context.visie),
    weekinput: json(context.weekinput),
    kern: json(context.kern),
    belastingshistoriek: json(context.belastingshistoriek),
    testen: json(context.testen),
    staf: json(Object.keys(context.staf).length ? context.staf : null),
    feedback: json(context.feedback),
  });
  return { system, user };
}
