import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  ROLE_DIRS,
  ROLE_FILES,
  ROLE_ID_PATTERN,
  ROLE_TASKS_DIR,
  ROLE_TEMPLATE_FILE,
  SHARED_DIR,
  SHARED_FILES,
  SHARED_TEXT_FILES,
} from "./layout";
import { parseMarkdown, sectionHeadings } from "./markdown";
import { createAjv } from "./output";
import { TEMPLATE_PLACEHOLDERS, templatePlaceholders } from "./prompt";
import { parseMatchDays } from "./shared/matchdays";
import { parsePeriodization } from "./shared/periodization";
import { parseTests } from "./shared/tests";
import { parseFormations } from "./shared/formations";
import { parsePositions } from "./shared/positions";
import { parseVisionQuestionnaire } from "./shared/vision";
import {
  ROLE_STATUSES,
  type RoleMeta,
  type RoleStatus,
  type Staff,
  type StaffFile,
  type StaffIssue,
  type StaffRole,
  type StaffTask,
  StaffValidationError,
} from "./types";

interface LoadResult {
  staff: Staff | null;
  issues: StaffIssue[];
}

/** Loads /staff and throws a StaffValidationError if anything is wrong. */
export async function loadStaff(rootDir: string): Promise<Staff> {
  const { staff, issues } = await readStaff(rootDir);
  if (issues.length > 0 || !staff) throw new StaffValidationError(issues);
  return staff;
}

/** Returns all problems in /staff without throwing. */
export async function validateStaff(rootDir: string): Promise<StaffIssue[]> {
  return (await readStaff(rootDir)).issues;
}

async function readStaff(rootDir: string): Promise<LoadResult> {
  const root = path.resolve(rootDir);
  const issues: StaffIssue[] = [];

  if (!(await isDirectory(root))) {
    issues.push({ path: ".", message: `map bestaat niet: ${root}` });
    return { staff: null, issues };
  }

  const shared = await readFilesRecursive(root, SHARED_DIR);
  if (!(await isDirectory(path.join(root, SHARED_DIR)))) {
    issues.push({ path: SHARED_DIR, message: "map ontbreekt" });
  }

  const template = shared.find(
    (f) => f.path === `${SHARED_DIR}/${ROLE_TEMPLATE_FILE}`,
  );
  const requiredSections = template
    ? sectionHeadings(parseMarkdown(template.content).body)
    : [];
  if (!template) {
    issues.push({
      path: `${SHARED_DIR}/${ROLE_TEMPLATE_FILE}`,
      message: "rolsjabloon ontbreekt",
    });
  }

  const roles: StaffRole[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const role = await readRole(root, entry.name, requiredSections, issues);
    if (role) roles.push(role);
  }
  roles.sort((a, b) => a.id.localeCompare(b.id));

  const positions = collect(
    parsePositions(readSharedJson(shared, SHARED_FILES.positions, issues)),
    issues,
  );
  const formations = collect(
    parseFormations(readSharedJson(shared, SHARED_FILES.formations, issues), positions),
    issues,
  );

  const vision = collect(
    parseVisionQuestionnaire(readSharedJson(shared, SHARED_FILES.vision, issues)),
    issues,
  );

  const matchDays = collect(
    parseMatchDays(readSharedJson(shared, SHARED_FILES.matchDays, issues)),
    issues,
  );
  const periodization = collect(
    parsePeriodization(readSharedJson(shared, SHARED_FILES.periodization, issues)),
    issues,
  );
  const tests = collect(parseTests(readSharedJson(shared, SHARED_FILES.tests, issues)), issues);
  checkTemplates(shared, issues);

  if (!positions || !formations || !vision || !matchDays || !periodization || !tests) {
    return { staff: null, issues };
  }
  return {
    staff: { rootDir: root, shared, roles, positions, formations, vision, matchDays, periodization, tests },
    issues,
  };
}

/** Required shared text files exist and templates only use known placeholders. */
function checkTemplates(shared: StaffFile[], issues: StaffIssue[]) {
  for (const fileName of Object.values(SHARED_TEXT_FILES)) {
    const filePath = `${SHARED_DIR}/${fileName}`;
    const file = shared.find((f) => f.path === filePath);
    if (!file) {
      issues.push({ path: filePath, message: "bestand ontbreekt" });
      continue;
    }
    const allowed =
      fileName === SHARED_TEXT_FILES.systemTemplate
        ? TEMPLATE_PLACEHOLDERS.system
        : fileName === SHARED_TEXT_FILES.userTemplate
          ? TEMPLATE_PLACEHOLDERS.user
          : null;
    if (!allowed) continue;
    for (const name of templatePlaceholders(file.content)) {
      if (!(allowed as readonly string[]).includes(name)) {
        issues.push({ path: filePath, message: `onbekend invulveld {{${name}}} (toegelaten: ${allowed.join(", ")})` });
      }
    }
  }
}

function collect<T>(result: { value: T | null; issues: StaffIssue[] }, issues: StaffIssue[]) {
  issues.push(...result.issues);
  return result.value;
}

/** Parses a JSON file from _gedeeld; returns undefined (and records an issue) if missing/invalid. */
function readSharedJson(shared: StaffFile[], fileName: string, issues: StaffIssue[]): unknown {
  const filePath = `${SHARED_DIR}/${fileName}`;
  const file = shared.find((f) => f.path === filePath);
  if (!file) {
    issues.push({ path: filePath, message: "bestand ontbreekt" });
    return undefined;
  }
  try {
    return JSON.parse(file.content);
  } catch (error) {
    issues.push({ path: filePath, message: `geen geldige JSON: ${(error as Error).message}` });
    return undefined;
  }
}

async function readRole(
  root: string,
  id: string,
  requiredSections: string[],
  issues: StaffIssue[],
): Promise<StaffRole | null> {
  const before = issues.length;

  if (!ROLE_ID_PATTERN.test(id)) {
    issues.push({
      path: id,
      message: "rol-id moet Engelse kebab-case zijn (bv. tactical-coach)",
    });
  }

  const descriptionPath = `${id}/${ROLE_FILES.description}`;
  const instructionsPath = `${id}/${ROLE_FILES.instructions}`;
  const schemaPath = `${id}/${ROLE_FILES.outputSchema}`;

  const descriptionSource = await readText(root, descriptionPath, issues);
  const instructions = await readText(root, instructionsPath, issues);
  const schemaSource = await readText(root, schemaPath, issues);

  let meta: RoleMeta | null = null;
  let description = "";
  if (descriptionSource !== null) {
    const parsed = parseMarkdown(descriptionSource);
    description = parsed.body;
    meta = parseRoleMeta(id, parsed.frontmatter, descriptionPath, issues);

    const present = new Set(sectionHeadings(parsed.body));
    for (const section of requiredSections) {
      if (!present.has(section)) {
        issues.push({
          path: descriptionPath,
          message: `verplichte sectie ontbreekt: "## ${section}"`,
        });
      }
    }
  }

  const outputSchema =
    schemaSource === null ? null : parseSchema(schemaSource, schemaPath, issues);

  for (const dir of Object.values(ROLE_DIRS)) {
    if (!(await isDirectory(path.join(root, id, dir)))) {
      issues.push({ path: `${id}/${dir}`, message: "map ontbreekt" });
    }
  }

  const tasks = await readTasks(root, id, issues);

  if (issues.length > before || !meta || instructions === null || !outputSchema) {
    return null;
  }

  return {
    id,
    meta,
    description,
    instructions,
    outputSchema,
    references: await readFilesRecursive(root, `${id}/${ROLE_DIRS.references}`),
    examples: await readFilesRecursive(root, `${id}/${ROLE_DIRS.examples}`),
    tests: await readFilesRecursive(root, `${id}/${ROLE_DIRS.tests}`),
    tasks,
  };
}

async function readTasks(root: string, roleId: string, issues: StaffIssue[]): Promise<StaffTask[]> {
  const dir = path.join(root, roleId, ROLE_TASKS_DIR);
  if (!(await isDirectory(dir))) return [];
  const tasks: StaffTask[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const base = `${roleId}/${ROLE_TASKS_DIR}/${entry.name}`;
    if (!ROLE_ID_PATTERN.test(entry.name)) {
      issues.push({ path: base, message: "taak-id moet kebab-case zijn" });
      continue;
    }
    const instructions = await readText(root, `${base}/${ROLE_FILES.instructions}`, issues);
    const schemaSource = await readText(root, `${base}/${ROLE_FILES.outputSchema}`, issues);
    const outputSchema =
      schemaSource === null ? null : parseSchema(schemaSource, `${base}/${ROLE_FILES.outputSchema}`, issues);
    if (instructions === null || !outputSchema) continue;
    tasks.push({
      id: entry.name,
      instructions,
      outputSchema,
      examples: await readFilesRecursive(root, `${base}/${ROLE_DIRS.examples}`),
    });
  }
  return tasks.sort((a, b) => a.id.localeCompare(b.id));
}

function parseRoleMeta(
  id: string,
  frontmatter: Record<string, unknown> | null,
  filePath: string,
  issues: StaffIssue[],
): RoleMeta | null {
  if (!frontmatter) {
    issues.push({ path: filePath, message: "frontmatter (---) ontbreekt" });
    return null;
  }
  const before = issues.length;
  const text = (key: string): string => {
    const value = frontmatter[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    issues.push({ path: filePath, message: `frontmatter-veld "${key}" ontbreekt` });
    return "";
  };

  const metaId = text("id");
  const naam = text("naam");
  const versie = text("versie");
  const status = text("status");

  if (metaId && metaId !== id) {
    issues.push({
      path: filePath,
      message: `frontmatter-id "${metaId}" verschilt van de mapnaam "${id}"`,
    });
  }
  if (status && !ROLE_STATUSES.includes(status as RoleStatus)) {
    issues.push({
      path: filePath,
      message: `ongeldige status "${status}" (toegelaten: ${ROLE_STATUSES.join(", ")})`,
    });
  }
  if (issues.length > before) return null;
  return { id, naam, versie, status: status as RoleStatus };
}

function parseSchema(
  source: string,
  filePath: string,
  issues: StaffIssue[],
): Record<string, unknown> | null {
  let schema: unknown;
  try {
    schema = JSON.parse(source);
  } catch (error) {
    issues.push({ path: filePath, message: `geen geldige JSON: ${(error as Error).message}` });
    return null;
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    issues.push({ path: filePath, message: "schema moet een JSON-object zijn" });
    return null;
  }
  try {
    createAjv().compile(schema);
  } catch (error) {
    issues.push({ path: filePath, message: `geen geldig JSON Schema: ${(error as Error).message}` });
    return null;
  }
  return schema as Record<string, unknown>;
}

async function readText(
  root: string,
  relativePath: string,
  issues: StaffIssue[],
): Promise<string | null> {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch {
    issues.push({ path: relativePath, message: "bestand ontbreekt" });
    return null;
  }
}

/** Reads all non-hidden files under a directory; returns [] if it does not exist. */
async function readFilesRecursive(root: string, relativeDir: string): Promise<StaffFile[]> {
  const absolute = path.join(root, relativeDir);
  if (!(await isDirectory(absolute))) return [];

  const files: StaffFile[] = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await readFilesRecursive(root, relativePath)));
    } else if (entry.isFile()) {
      files.push({
        path: relativePath,
        content: await readFile(path.join(root, relativePath), "utf8"),
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function isDirectory(absolutePath: string): Promise<boolean> {
  try {
    return (await stat(absolutePath)).isDirectory();
  } catch {
    return false;
  }
}
