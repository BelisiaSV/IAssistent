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
  type SeasonPlan,
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

const season = (over: Partial<SeasonPlan> = {}): SeasonPlan => ({
  preparationStart: null,
  preparationWeeks: 4,
  competitionStart: "2026-09-06",
  competitionWeeks: 4,
  ...over,
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
      periodisering: weekPeriodization("2026-10-19", season(), staff.periodization),
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
    bibliotheek: [],
    staf: {},
    feedback: null,
  };
}

const exercise = (over: Partial<RoleContext["bibliotheek"][number]>): RoleContext["bibliotheek"][number] => ({
  id: "ex",
  soort: "oefening",
  titel: "Oefening",
  fase: "kern",
  labels: [],
  spelers: { min: null, max: null },
  duur_min: null,
  reeksen: null,
  werk_min: null,
  rust_min: null,
  intensiteit: null,
  rpe: null,
  organisatie: null,
  verloop: [],
  coachingspunten: [],
  variaties: [],
  animatie: false,
  standaardsituatie: null,
  ...over,
});

const library = () => [
  exercise({ id: "rondo", titel: "Rondo 5v2", fase: "opwarming", duur_min: 12, intensiteit: "matig", rpe: 4 }),
  exercise({ id: "pos", titel: "Positiespel 6v6", reeksen: 4, werk_min: 6, rust_min: 2, intensiteit: "hoog", rpe: 8, labels: ["balbezit"], coachingspunten: ["Speel de derde man"] }),
  exercise({ id: "ssg", titel: "4v4 kleine ruimte", reeksen: 6, werk_min: 3, rust_min: 1.5, intensiteit: "maximaal", rpe: 9 }),
  exercise({ id: "groot", titel: "11v11", spelers: { min: 18, max: 22 } }),
];

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
      weekPeriodization(week, season({ competitionWeeks: cycle }), staff.periodization).weektype?.code;
    // 2026-09-06 is a Sunday: its week starts on Monday 2026-08-31.
    expect(type("2026-08-24")).toBe("voorbereiding");
    expect(type("2026-08-31")).toBe("normaal");
    expect(type("2026-09-07")).toBe("extensief");
    expect(type("2026-09-14")).toBe("intensief");
    expect(type("2026-09-21")).toBe("deload");
    expect(type("2026-09-28")).toBe("normaal");
    expect(weekPeriodization("2026-10-05", season({ competitionWeeks: 6 }), staff.periodization)).toMatchObject({
      fase: "competitie",
      week_van_fase: 6,
      cyclus_weken: 6,
      week_in_cyclus: 6,
    });
    expect(weekPeriodization("2026-10-05", season({ competitionStart: null }), staff.periodization).fase).toBeNull();
  });

  it("runs its own cycle in the preparation", () => {
    // Preparation from Monday 2026-07-06, cycle of 6 weeks; competition from 2026-09-06.
    const plan = season({ preparationStart: "2026-07-06", preparationWeeks: 6 });
    const at = (week: string) => weekPeriodization(week, plan, staff.periodization);
    expect(at("2026-06-29")).toMatchObject({ fase: null, weektype: null });
    expect(at("2026-07-06")).toMatchObject({ fase: "voorbereiding", week_van_fase: 1, cyclus_weken: 6, week_in_cyclus: 1 });
    expect(at("2026-08-17")).toMatchObject({ fase: "voorbereiding", week_van_fase: 7, week_in_cyclus: 1 });
    expect(at("2026-08-31")).toMatchObject({ fase: "competitie", week_van_fase: 1, cyclus_weken: 4 });
    // Preparation only, competition not yet planned.
    expect(weekPeriodization("2026-07-13", season({ preparationStart: "2026-07-06", competitionStart: null }), staff.periodization).fase).toBe("voorbereiding");
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

  it("uses the coach's own set pieces first, with at most one new one", async () => {
    const corner = exercise({
      id: "corner",
      soort: "standaardsituatie",
      titel: "Corner kort",
      fase: null,
      verloop: ["Kort op de 10, voorzet op de tweede paal"],
      standaardsituatie: { type: "hoekschop_aanvallend", teken: "Twee vingers", rollen: [{ rol: "Nemer", vereiste: "linksvoetig" }, { rol: "Eerste paal", vereiste: null }] },
    });
    const odd = exercise({ id: "odd", soort: "standaardsituatie", fase: null, standaardsituatie: { type: "onbekend", teken: null, rollen: [] } });
    const ctx = { ...context(), kern: squad(), bibliotheek: [corner, odd, exercise({ id: "pos" })] };
    const result = await runRole(staff, "tactical-coach", ctx, exampleProvider);
    const pieces = (result.output as { standaardsituaties: { standaardsituatie_id: string | null; titel: string; soort: string; afspraken: string[]; taken: { rugnummer: number; taak: string }[] }[] }).standaardsituaties;
    expect(pieces[0]).toMatchObject({ standaardsituatie_id: "corner", titel: "Corner kort", soort: "hoekschop_aanvallend", afspraken: ["Kort op de 10, voorzet op de tweede paal"] });
    expect(pieces[0]!.taken.map((t) => t.taak)).toEqual(["Nemer (linksvoetig)", "Eerste paal"]);
    const available = ctx.kern.filter((p) => p.beschikbaar && !p.posities.includes("GK")).map((p) => p.rugnummer);
    for (const t of pieces[0]!.taken) expect(available).toContain(t.rugnummer);
    // Unknown types and exercises are not used; one new set piece of another type.
    expect(pieces.filter((p) => p.standaardsituatie_id === null)).toHaveLength(1);
    expect(pieces.some((p) => p.standaardsituatie_id === "odd" || p.standaardsituatie_id === "pos")).toBe(false);

    // The match preparation keeps the id.
    const prep = await runRole(staff, "tactical-coach", { ...ctx, staf: { "tactical-coach": result.output } }, exampleProvider, "wedstrijdvoorbereiding");
    expect((prep.output as { standaardsituaties: { standaardsituatie_id: string | null }[] }).standaardsituaties[0]!.standaardsituatie_id).toBe("corner");
  });

  it("does not plan set pieces as training exercises", async () => {
    const corner = exercise({ id: "corner", soort: "standaardsituatie", fase: null, standaardsituatie: { type: "hoekschop_aanvallend", teken: null, rollen: [] } });
    const result = await runRole(staff, "assistant-coach", { ...context(), bibliotheek: [corner] }, exampleProvider);
    const parts = (result.output as { dagen: { onderdelen: { oefening_id: string | null }[] }[] }).dagen.flatMap((d) => d.onderdelen);
    expect(parts.every((p) => p.oefening_id === null)).toBe(true);
  });

  it("does not draw parts from the coach's library", async () => {
    const planning = (await runRole(staff, "assistant-coach", { ...context(), bibliotheek: library() }, exampleProvider)).output as {
      dagen: { onderdelen: { naam: string; oefening_id: string | null }[] }[];
    };
    const own = planning.dagen.flatMap((d) => d.onderdelen.filter((o) => !o.oefening_id).map((o) => o.naam));
    const result = await runRole(staff, "tactical-coach", { ...context(), staf: { "assistant-coach": planning } }, exampleProvider, "oefenstof");
    expect((result.output as { oefeningen: { onderdeel: string }[] }).oefeningen.map((o) => o.onderdeel)).toEqual(own);
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

    const withLibrary = buildRolePrompt(staff, role, { ...context(), bibliotheek: library() });
    expect(withLibrary.user).toContain('"titel": "Positiespel 6v6"');

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

  it("plans exercises from the coach's library, scaled to the week type and match day", async () => {
    // Week of 2026-10-19 is a deload week; the physical coach caps MD-3 at RPE 7.
    const physical = { dagen: [{ datum: "2026-10-22", rpe_doel: 7 }] };
    const result = await runRole(staff, "assistant-coach", { ...context(), bibliotheek: library(), staf: { "physical-coach": physical } }, exampleProvider);
    type Part = { oefening_id: string | null; fase: string; naam: string; duur_min: number; reeksen: number | null; werk_per_reeks: string | null; rust_tussen_reeksen: string | null; rpe: number | null; coachingspunten: string[] };
    const days = (result.output as { dagen: { datum: string; md: string; totale_duur_min: number | null; onderdelen: Part[] }[] }).dagen;
    const all = days.flatMap((d) => d.onderdelen);
    // The 11v11 needs more players than available; phases match.
    expect(all.some((p) => p.oefening_id === "groot")).toBe(false);
    for (const p of all.filter((x) => x.oefening_id)) {
      expect(library().find((e) => e.id === p.oefening_id)!.fase).toBe(p.fase);
    }
    const factor = (md: string) => staff.periodization.weektypes.find((w) => w.code === "deload")!.reeksen_factor! * (staff.matchDays.dagen.find((m) => m.code === md)?.reeksen_factor ?? 1);
    const md3 = days.find((d) => d.md === "MD-3")!;
    const pos = all.find((p) => p.oefening_id === "pos")!;
    expect(pos).toMatchObject({ naam: "Positiespel 6v6", werk_per_reeks: "6 min", coachingspunten: ["Speel de derde man"] });
    expect(pos.duur_min).toBe(Math.ceil(pos.reeksen! * 6 + (pos.reeksen! - 1) * 2));
    expect(pos.reeksen).toBeLessThanOrEqual(Math.max(1, Math.round(4 * factor(days.find((d) => d.onderdelen.includes(pos))!.md))));
    for (const p of md3.onderdelen) if (p.oefening_id) expect(p.rpe).toBeLessThanOrEqual(7);
    for (const d of days) {
      if (d.totale_duur_min) expect(d.onderdelen.reduce((s, p) => s + p.duur_min, 0)).toBeLessThanOrEqual(d.totale_duur_min);
    }
    // Each exercise once before any is used twice (3 usable exercises).
    const ids = all.flatMap((p) => (p.oefening_id ? [p.oefening_id] : []));
    expect(new Set(ids.slice(0, 2)).size).toBe(2);
  });

  it("uses exercises for any number of players when the squad is empty", async () => {
    const result = await runRole(staff, "assistant-coach", { ...context(), kern: [], bibliotheek: [exercise({ id: "groot", spelers: { min: 18, max: 22 } })] }, exampleProvider);
    const parts = (result.output as { dagen: { onderdelen: { oefening_id: string | null }[] }[] }).dagen.flatMap((d) => d.onderdelen);
    expect(parts.some((p) => p.oefening_id === "groot")).toBe(true);
  });

  it("uses an exercise once per training", async () => {
    const one = exercise({ id: "pos", reeksen: 4, werk_min: 3, rust_min: 1 });
    const result = await runRole(staff, "assistant-coach", { ...context(), bibliotheek: [one] }, exampleProvider);
    for (const day of (result.output as { dagen: { onderdelen: { oefening_id: string | null }[] }[] }).dagen) {
      expect(day.onderdelen.filter((p) => p.oefening_id === "pos").length).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the example parts without a library", async () => {
    const result = await runRole(staff, "assistant-coach", context(), exampleProvider);
    const parts = (result.output as { dagen: { onderdelen: { oefening_id: string | null }[] }[] }).dagen.flatMap((d) => d.onderdelen);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((p) => p.oefening_id === null)).toBe(true);
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
