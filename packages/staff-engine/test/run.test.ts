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
  testDue,
  validateOutput,
  weekPeriodization,
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
      periodisering: weekPeriodization("2026-10-19", "2026-09-06", 4, staff.periodization),
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
      { rugnummer: 1, posities: ["GK"], voet: "rechts", beschikbaar: true, status: "beschikbaar", terug_verwacht: null, mas_kmh: 16.5, mas_test_datum: "2026-09-01" },
      { rugnummer: 9, posities: ["ST"], voet: "rechts", beschikbaar: false, status: "geblesseerd", terug_verwacht: "2026-11-01", mas_kmh: null, mas_test_datum: null },
    ],
    visie: { samenvatting: "Dominant voetbal.", antwoorden: [] },
    belastingshistoriek: [],
    testen: [],
    tegenstander: {
      naam: "KFC Voorbeeld",
      thuis: true,
      formatie: "4-4-2",
      speelstijl: "Direct",
      sterktes: null,
      zwaktes: null,
      standaardsituaties: null,
      notities: null,
      opstelling: { bron: "coach", datum: "2026-09-20", formatie: "4-4-2", basis: [{ post: "ST", rugnummer: 9 }], bank: [14] },
    },
    evaluaties: [],
    staf: {},
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

describe("periodization", () => {
  it("counts cycle weeks from the week of the first competition match", () => {
    const type = (week: string, cycle = 4) =>
      weekPeriodization(week, "2026-09-06", cycle, staff.periodization).weektype?.code;
    // 2026-09-06 is a Sunday: its week starts on Monday 2026-08-31.
    expect(type("2026-08-24")).toBe("voorbereiding");
    expect(type("2026-08-31")).toBe("normaal");
    expect(type("2026-09-07")).toBe("extensief");
    expect(type("2026-09-14")).toBe("intensief");
    expect(type("2026-09-21")).toBe("deload");
    expect(type("2026-09-28")).toBe("normaal");
    expect(weekPeriodization("2026-10-05", "2026-09-06", 6, staff.periodization)).toMatchObject({
      fase: "competitie",
      cyclus_weken: 6,
      week_in_cyclus: 6,
    });
    expect(weekPeriodization("2026-10-05", null, 4, staff.periodization).fase).toBeNull();
  });

  it("knows when a test is due", () => {
    expect(testDue(null, "2026-10-19", 8)).toBe(true);
    expect(testDue("2026-09-01", "2026-10-19", 8)).toBe(false);
    expect(testDue("2026-08-25", "2026-10-19", 8)).toBe(true);
  });
});

describe("assistant coach content", () => {
  it("has an example that matches its output schema", () => {
    const role = staff.roles.find((r) => r.id === "assistant-coach")!;
    expect(validateOutput(role.outputSchema, roleExample(role))).toEqual({ ok: true });
  });
});

describe("physical coach", () => {
  it("has an example that matches its output schema", () => {
    const role = staff.roles.find((r) => r.id === "physical-coach")!;
    expect(validateOutput(role.outputSchema, roleExample(role))).toEqual({ ok: true });
  });

  it("builds a valid load plan in test mode, with this week's type", async () => {
    const result = await runRole(staff, "physical-coach", context(), exampleProvider);
    const output = result.output as { weektype: string; dagen: { datum: string; soort: string }[] };
    expect(output.weektype).toBe(context().weekinput.periodisering.weektype?.code);
    expect(output.dagen.map((d) => d.soort)).toEqual(["rust", "training", "rust", "training", "rust", "rust", "wedstrijd"]);
  });
});

describe("tactical coach", () => {
  const squad = () => [
    { rugnummer: 1, posities: ["GK"], voet: "rechts", beschikbaar: true, status: "beschikbaar", terug_verwacht: null, mas_kmh: null, mas_test_datum: null },
    { rugnummer: 4, posities: ["CB"], voet: "rechts", beschikbaar: true, status: "beschikbaar", terug_verwacht: null, mas_kmh: null, mas_test_datum: null },
    { rugnummer: 9, posities: ["ST"], voet: "rechts", beschikbaar: true, status: "beschikbaar", terug_verwacht: null, mas_kmh: null, mas_test_datum: null },
    { rugnummer: 5, posities: ["CB"], voet: "links", beschikbaar: false, status: "geblesseerd", terug_verwacht: null, mas_kmh: null, mas_test_datum: null },
  ];

  it("has valid examples for all tasks", () => {
    const role = staff.roles.find((r) => r.id === "tactical-coach")!;
    expect(role.tasks.map((t) => t.id).sort()).toEqual(["oefenstof", "wedstrijdvoorbereiding"]);
    expect(validateOutput(role.outputSchema, roleExample(role))).toEqual({ ok: true });
    for (const task of role.tasks) {
      expect(validateOutput(task.outputSchema, roleExample(role, task.id))).toEqual({ ok: true });
    }
  });

  it("builds a tactical week plan with accents on the training days", async () => {
    const result = await runRole(staff, "tactical-coach", { ...context(), kern: squad() }, exampleProvider);
    const output = result.output as { tegenstander: { naam: string }; trainingsaccenten: { datum: string }[] };
    expect(output.tegenstander.naam).toBe("KFC Voorbeeld");
    expect(output.trainingsaccenten.map((a) => a.datum)).toEqual(["2026-10-20", "2026-10-22"]);
    expect(result.output).not.toHaveProperty("opstelling");
  });

  it("prepares the match with a lineup from available players and the set pieces of the week", async () => {
    const weekPlan = (await runRole(staff, "tactical-coach", context(), exampleProvider)).output as {
      standaardsituaties: { titel: string }[];
    };
    const result = await runRole(
      staff,
      "tactical-coach",
      { ...context(), kern: squad(), staf: { "tactical-coach": weekPlan } },
      exampleProvider,
      "wedstrijdvoorbereiding",
    );
    const output = result.output as {
      opstelling: { basis: { post: string; rugnummer: number }[] };
      standaardsituaties: { titel: string; taken: { rugnummer: number }[] }[];
    };
    const starters = output.opstelling.basis.map((b) => b.rugnummer);
    expect(output.opstelling.basis.find((b) => b.post === "GK")?.rugnummer).toBe(1);
    expect(starters).not.toContain(5);
    expect(output.standaardsituaties.map((s) => s.titel)).toEqual(weekPlan.standaardsituaties.map((s) => s.titel));
    for (const sp of output.standaardsituaties) {
      for (const t of sp.taken) expect(starters).toContain(t.rugnummer);
    }
  });

  it("draws every part of the week planning", async () => {
    const planning = (await runRole(staff, "assistant-coach", context(), exampleProvider)).output as {
      dagen: { onderdelen: { naam: string }[] }[];
    };
    const parts = planning.dagen.flatMap((d) => d.onderdelen.map((o) => o.naam));
    const result = await runRole(
      staff,
      "tactical-coach",
      { ...context(), staf: { "assistant-coach": planning } },
      exampleProvider,
      "oefenstof",
    );
    const output = result.output as { oefeningen: { onderdeel: string }[] };
    expect(output.oefeningen.map((o) => o.onderdeel)).toEqual(parts);
  });

  it("needs a week planning to draw", async () => {
    await expect(runRole(staff, "tactical-coach", context(), exampleProvider, "oefenstof")).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("uses the task instructions in the prompt", () => {
    const role = staff.roles.find((r) => r.id === "tactical-coach")!;
    const { system, user } = buildRolePrompt(staff, role, context(), "oefenstof");
    expect(system).toContain("taak 2: oefenstof uittekenen");
    expect(user).toContain('"naam": "KFC Voorbeeld"');
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
    expect(system).toContain('"code": "deload"');

    const withStaff = buildRolePrompt(staff, role, { ...context(), staf: { "physical-coach": { weektype: "intensief" } } });
    expect(withStaff.user).toContain('"physical-coach"');
  });
});

describe("runRole with the example provider", () => {
  it("builds a valid week from the example content", async () => {
    const result = await runRole(staff, "assistant-coach", context(), exampleProvider);
    const output = result.output as { dagen: { datum: string; soort: string; md: string | null; tijdstip: string | null }[]; individueel: { rugnummer: number }[] };
    expect(result.provider).toBe("example");
    expect(result.contentVersion).toBe(staff.roles.find((r) => r.id === "assistant-coach")!.meta.versie);
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
    await expect(runRole(staff, "video-analyst", context(), exampleProvider)).rejects.toMatchObject({
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
