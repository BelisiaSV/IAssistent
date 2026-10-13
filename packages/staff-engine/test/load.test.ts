import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadStaff, StaffValidationError, validateStaff } from "../src/index";

const REPO_STAFF_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../staff",
);

const TEMPLATE = `---
id: <rol-id>
naam: <naam>
versie: 0.0.0
status: placeholder
---

# Sjabloon

## Doel

## Grenzen
`;

const SCHEMA = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
});

let root: string;

async function write(relativePath: string, content: string) {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function writeRole(id: string, overrides: Partial<Record<string, string>> = {}) {
  await write(
    `${id}/rol.md`,
    overrides["rol.md"] ??
      `---\nid: ${id}\nnaam: Testrol\nversie: 0.1.0\nstatus: concept\n---\n\n# Testrol\n\n## Doel\n\nx\n\n## Grenzen\n\ny\n`,
  );
  await write(`${id}/instructies.md`, overrides["instructies.md"] ?? "# Instructies\n");
  await write(`${id}/output-schema.json`, overrides["output-schema.json"] ?? SCHEMA);
  for (const dir of ["referentie", "voorbeelden", "tests"]) {
    await mkdir(path.join(root, id, dir), { recursive: true });
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "staff-"));
  await write("_gedeeld/rol-sjabloon.md", TEMPLATE);
  await write("_gedeeld/afspraken.md", "# Afspraken\n");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("loadStaff", () => {
  it("loads shared files and roles", async () => {
    await writeRole("test-role");
    await write("test-role/referentie/bron.md", "# Bron\n");
    await write("test-role/referentie/sub/diep.md", "# Diep\n");
    await write("test-role/referentie/.gitkeep", "");

    const staff = await loadStaff(root);

    expect(staff.shared.map((f) => f.path)).toEqual([
      "_gedeeld/afspraken.md",
      "_gedeeld/rol-sjabloon.md",
    ]);
    expect(staff.roles).toHaveLength(1);
    const role = staff.roles[0]!;
    expect(role.meta).toEqual({
      id: "test-role",
      naam: "Testrol",
      versie: "0.1.0",
      status: "concept",
    });
    expect(role.description).toContain("## Doel");
    expect(role.description).not.toContain("---");
    expect(role.outputSchema).toMatchObject({ type: "object" });
    expect(role.references.map((f) => f.path)).toEqual([
      "test-role/referentie/bron.md",
      "test-role/referentie/sub/diep.md",
    ]);
  });

  it("ignores folders starting with _ or .", async () => {
    await writeRole("test-role");
    await mkdir(path.join(root, ".hidden"));
    await mkdir(path.join(root, "_archief"));

    const staff = await loadStaff(root);
    expect(staff.roles.map((r) => r.id)).toEqual(["test-role"]);
  });

  it("throws StaffValidationError with all issues", async () => {
    await writeRole("test-role", { "output-schema.json": "{ niet json" });
    await expect(loadStaff(root)).rejects.toBeInstanceOf(StaffValidationError);
  });
});

describe("validateStaff", () => {
  it("reports missing files and folders", async () => {
    await mkdir(path.join(root, "empty-role"));
    const issues = await validateStaff(root);
    const paths = issues.map((i) => i.path);
    expect(paths).toContain("empty-role/rol.md");
    expect(paths).toContain("empty-role/instructies.md");
    expect(paths).toContain("empty-role/output-schema.json");
    expect(paths).toContain("empty-role/referentie");
  });

  it("reports sections from the template that are missing", async () => {
    await writeRole("test-role", {
      "rol.md": "---\nid: test-role\nnaam: X\nversie: 1.0.0\nstatus: actief\n---\n\n## Doel\n",
    });
    const issues = await validateStaff(root);
    expect(issues).toEqual([
      { path: "test-role/rol.md", message: 'verplichte sectie ontbreekt: "## Grenzen"' },
    ]);
  });

  it("reports frontmatter problems", async () => {
    await writeRole("test-role", {
      "rol.md": "---\nid: other-id\nnaam: X\nversie: 1.0.0\nstatus: klaar\n---\n\n## Doel\n\n## Grenzen\n",
    });
    const messages = (await validateStaff(root)).map((i) => i.message);
    expect(messages.some((m) => m.includes("verschilt van de mapnaam"))).toBe(true);
    expect(messages.some((m) => m.includes('ongeldige status "klaar"'))).toBe(true);
  });

  it("reports an invalid JSON Schema", async () => {
    await writeRole("test-role", { "output-schema.json": '{ "type": "geen-type" }' });
    const issues = await validateStaff(root);
    expect(issues[0]?.message).toMatch(/geen geldig JSON Schema/);
  });

  it("reports role ids that are not kebab-case", async () => {
    await writeRole("Tactisch_Coach");
    const issues = await validateStaff(root);
    expect(issues.some((i) => i.message.includes("kebab-case"))).toBe(true);
  });

  it("reports a missing role template", async () => {
    await rm(path.join(root, "_gedeeld/rol-sjabloon.md"));
    const issues = await validateStaff(root);
    expect(issues).toContainEqual({
      path: "_gedeeld/rol-sjabloon.md",
      message: "rolsjabloon ontbreekt",
    });
  });
});

describe("repository /staff", () => {
  it("is valid and contains the four roles", async () => {
    const staff = await loadStaff(REPO_STAFF_DIR);
    expect(staff.roles.map((r) => r.id)).toEqual([
      "assistant-coach",
      "physical-coach",
      "tactical-coach",
      "video-analyst",
    ]);
  });
});
