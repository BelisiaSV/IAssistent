import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import {
  anthropicProvider,
  buildRolePrompt,
  exampleProvider,
  loadStaff,
  matchDayFor,
  type RoleContext,
  roleExample,
  runRole,
  type Staff,
  StaffGenerationError,
  type StaffModelProvider,
  validateOutput,
} from "../src/index";

const STAFF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../staff");
let staff: Staff;

beforeAll(async () => {
  staff = await loadStaff(STAFF_DIR);
});

const day = (datum: string, weekdag: string, md: string | null, extra: Partial<RoleContext["weekinput"]["dagen"][number]> = {}) => ({
  datum,
  weekdag,
  md,
  training: null,
  wedstrijd: null,
  ...extra,
});

function context(): RoleContext {
  return {
    weekinput: {
      week_van: "2026-10-19",
      vorige_wedstrijd: "2026-10-18",
      notitie: "Focus op omschakeling.",
      dagen: [
        day("2026-10-19", "maandag", "MD+1"),
        day("2026-10-20", "dinsdag", "MD+2", { training: { aanvang: "20:00", duur_min: 75 } }),
        day("2026-10-21", "woensdag", "MD-4"),
        day("2026-10-22", "donderdag", "MD-3", { training: { aanvang: "20:00", duur_min: 90 } }),
        day("2026-10-23", "vrijdag", "MD-2"),
        day("2026-10-24", "zaterdag", "MD-1"),
        day("2026-10-25", "zondag", "MD", {
          wedstrijd: { aanvang: "15:00", tegenstander: "KFC Voorbeeld", thuis: true },
        }),
      ],
    },
    kern: [
      { rugnummer: 1, posities: ["GK"], voet: "rechts", beschikbaar: true, status: "beschikbaar", terug_verwacht: null },
      { rugnummer: 9, posities: ["ST"], voet: "rechts", beschikbaar: false, status: "geblesseerd", terug_verwacht: "2026-11-01" },
    ],
    visie: { samenvatting: "Dominant voetbal.", antwoorden: [] },
    feedback: null,
  };
}

describe("match days", () => {
  it("labels days around a match, using the catalog order for priority", () => {
    const md = (date: string, matches: string[]) => matchDayFor(date, matches, staff.matchDays)?.code ?? null;
    expect(md("2026-10-25", ["2026-10-25"])).toBe("MD");
    expect(md("2026-10-22", ["2026-10-25"])).toBe("MD-3");
    expect(md("2026-10-19", ["2026-10-18", "2026-10-25"])).toBe("MD+1");
    expect(md("2026-10-12", ["2026-10-25"])).toBeNull();
    // Midweek match on Wednesday and Sunday: Thursday is MD+1 before MD-3.
    expect(md("2026-10-22", ["2026-10-21", "2026-10-25"])).toBe("MD+1");
  });
});

describe("assistant coach content", () => {
  it("has an example that matches its output schema", () => {
    const role = staff.roles.find((r) => r.id === "assistant-coach")!;
    expect(validateOutput(role.outputSchema, roleExample(role))).toEqual({ ok: true });
  });
});

describe("buildRolePrompt", () => {
  it("fills every placeholder from /staff and the context", () => {
    const role = staff.roles.find((r) => r.id === "assistant-coach")!;
    const { system, user } = buildRolePrompt(staff, role, context());
    expect(system).not.toMatch(/\{\{/);
    expect(user).not.toMatch(/\{\{/);
    expect(system).toContain(role.instructions.trim().split("\n")[0]);
    expect(user).toContain('"tegenstander": "KFC Voorbeeld"');
    expect(user).toContain('"rugnummer": 9');
  });
});

describe("runRole with the example provider", () => {
  it("builds a valid week from the example content", async () => {
    const result = await runRole(staff, "assistant-coach", context(), exampleProvider);
    const output = result.output as { dagen: { datum: string; soort: string; md: string | null; tijdstip: string | null }[]; individueel: { rugnummer: number }[] };
    expect(result.provider).toBe("example");
    expect(result.contentVersion).toBe("0.1.0");
    expect(output.dagen.map((d) => [d.datum, d.soort, d.md])).toEqual([
      ["2026-10-19", "rust", "MD+1"],
      ["2026-10-20", "training", "MD+2"],
      ["2026-10-21", "rust", "MD-4"],
      ["2026-10-22", "training", "MD-3"],
      ["2026-10-23", "rust", "MD-2"],
      ["2026-10-24", "rust", "MD-1"],
      ["2026-10-25", "wedstrijd", "MD"],
    ]);
    expect(output.dagen[1]!.tijdstip).toBe("20:00");
    expect(output.individueel.map((i) => i.rugnummer)).toEqual([9]);
  });

  it("refuses placeholder roles", async () => {
    await expect(runRole(staff, "physical-coach", context(), exampleProvider)).rejects.toMatchObject({
      code: "role_not_ready",
    });
  });

  it("rejects output that does not match the schema", async () => {
    const broken: StaffModelProvider = {
      id: "example",
      generate: async () => ({ output: { weekfocus: 1 }, provider: "example", model: null, usage: null }),
    };
    const error = await runRole(staff, "assistant-coach", context(), broken).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StaffGenerationError);
    expect((error as StaffGenerationError).code).toBe("invalid_output");
  });
});

describe("anthropicProvider (fake client, no network)", () => {
  function fakeClient(message: Record<string, unknown>) {
    const calls: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            calls.push(params);
            return { finalMessage: async () => message };
          },
        },
      },
    };
    return { client: client as never, calls };
  }

  it("sends the schema as structured output with fallbacks, and parses the answer", async () => {
    const role = staff.roles.find((r) => r.id === "assistant-coach")!;
    const example = roleExample(role);
    const { client, calls } = fakeClient({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 20 },
      content: [{ type: "text", text: JSON.stringify(example) }],
    });
    const result = await runRole(staff, "assistant-coach", context(), anthropicProvider({ client }));
    expect(result.output).toEqual(example);
    expect(result.model).toBe("claude-opus-5-5");

    const params = calls[0]!;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    const format = (params.output_config as { format: { type: string; schema: Record<string, unknown> } }).format;
    expect(format.type).toBe("json_schema");
    expect(format.schema.$schema).toBeUndefined();
    expect(format.schema.required).toEqual(role.outputSchema.required);
  });

  it("turns a refusal into a StaffGenerationError", async () => {
    const { client } = fakeClient({ model: "x", stop_reason: "refusal", usage: {}, content: [] });
    await expect(runRole(staff, "assistant-coach", context(), anthropicProvider({ client }))).rejects.toMatchObject({
      code: "refusal",
    });
  });
});
