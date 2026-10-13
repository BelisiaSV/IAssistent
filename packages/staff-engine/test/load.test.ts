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

const POSITIONS = {
  versie: "0.1.0",
  linies: [{ id: "doel", naam: "Doel" }, { id: "veld", naam: "Veld" }],
  posities: [
    { code: "GK", naam: "Doelman", linie: "doel" },
    { code: "ST", naam: "Spits", linie: "veld" },
  ],
};

const FORMATIONS = {
  versie: "0.1.0",
  formaties: [
    {
      code: "1-1",
      naam: "1-1",
      posten: [
        { id: "GK", positie: "GK", x: 50, y: 90 },
        { id: "ST", positie: "ST", x: 50, y: 10 },
      ],
    },
  ],
};

const VISION = {
  versie: "0.1.0",
  themas: [
    {
      id: "spel",
      titel: "Spel",
      vragen: [{ id: "zin", vraag: "In één zin?", type: "kort_antwoord" }],
    },
  ],
};

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
  await write("_gedeeld/posities.json", JSON.stringify(POSITIONS));
  await write("_gedeeld/formaties.json", JSON.stringify(FORMATIONS));
  await write("_gedeeld/visieprofiel.json", JSON.stringify(VISION));
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
      "_gedeeld/formaties.json",
      "_gedeeld/posities.json",
      "_gedeeld/rol-sjabloon.md",
      "_gedeeld/visieprofiel.json",
    ]);
    expect(staff.positions.posities.map((p) => p.code)).toEqual(["GK", "ST"]);
    expect(staff.formations.formaties[0]?.posten).toHaveLength(2);
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

describe("shared content", () => {
  it("reports a missing positions file", async () => {
    await rm(path.join(root, "_gedeeld/posities.json"));
    const issues = await validateStaff(root);
    expect(issues).toContainEqual({ path: "_gedeeld/posities.json", message: "bestand ontbreekt" });
  });

  it("reports positions that point to an unknown line and duplicate codes", async () => {
    await write(
      "_gedeeld/posities.json",
      JSON.stringify({
        ...POSITIONS,
        posities: [...POSITIONS.posities, { code: "GK", naam: "X", linie: "onbekend" }],
      }),
    );
    const messages = (await validateStaff(root)).map((i) => i.message);
    expect(messages).toContain('positie "GK" komt dubbel voor');
    expect(messages).toContain('positie "GK" verwijst naar onbekende linie "onbekend"');
  });

  it("reports formation slots with unknown positions, duplicate ids or bad coordinates", async () => {
    await write(
      "_gedeeld/formaties.json",
      JSON.stringify({
        versie: "0.1.0",
        formaties: [
          {
            code: "x",
            naam: "x",
            posten: [
              { id: "A", positie: "CB", x: 10, y: 10 },
              { id: "A", positie: "GK", x: 10, y: 10 },
            ],
          },
        ],
      }),
    );
    const messages = (await validateStaff(root)).map((i) => i.message);
    expect(messages).toContain('formatie "x": post "A" komt dubbel voor');
    expect(messages).toContain('formatie "x": post "A" verwijst naar onbekende positie "CB"');

    await write(
      "_gedeeld/formaties.json",
      JSON.stringify({
        versie: "0.1.0",
        formaties: [{ code: "x", naam: "x", posten: [{ id: "A", positie: "GK", x: 120, y: 0 }] }],
      }),
    );
    const issues = await validateStaff(root);
    expect(issues[0]?.path).toBe("_gedeeld/formaties.json");
    expect(issues[0]?.message).toMatch(/^formaties\.0\.posten\.0\.x:/);
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
    expect(staff.formations.formaties.length).toBeGreaterThan(0);
    expect(staff.vision.themas.length).toBeGreaterThan(0);
  });
});
