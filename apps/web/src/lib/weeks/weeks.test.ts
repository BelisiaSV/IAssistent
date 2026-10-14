import { describe, expect, it } from "vitest";

import type { Staff } from "@iassistent/staff-engine/content";

import bundle from "@/generated/staff.json";

import { buildRoleContext, loadHistory, sessionAu, weekLabels } from "./context";
import { addDays, isoWeekday, mondayOf, weekDates } from "./dates";
import { weekPlanSchema } from "./validation";

const staff = bundle as unknown as Staff;

describe("dates", () => {
  it("finds Mondays and week dates", () => {
    expect(mondayOf("2026-10-15")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(isoWeekday("2026-10-18")).toBe(7);
    expect(weekDates("2026-10-12")).toHaveLength(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("weekPlanSchema", () => {
  const schema = weekPlanSchema("2026-10-19");
  const base = { trainings: [], matches: [], previousMatchDate: "2026-10-18", notes: "" };

  it("accepts and sorts a normal week", () => {
    const parsed = schema.parse({
      ...base,
      trainings: [
        { date: "2026-10-22", start: "19:30", duration_min: "90" },
        { date: "2026-10-20", start: "19:30", duration_min: 90 },
      ],
      matches: [{ date: "2026-10-25", start: "15:00", opponent: "X", home: true }],
    });
    expect(parsed.trainings.map((t) => t.date)).toEqual(["2026-10-20", "2026-10-22"]);
    expect(parsed.notes).toBeNull();
  });

  it("rejects activities outside the week or two on one day", () => {
    expect(
      schema.safeParse({ ...base, trainings: [{ date: "2026-10-27", start: "19:30", duration_min: 90 }] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        trainings: [{ date: "2026-10-25", start: "10:00", duration_min: 60 }],
        matches: [{ date: "2026-10-25", start: "15:00", opponent: "X", home: true }],
      }).success,
    ).toBe(false);
  });
});

describe("buildRoleContext", () => {
  it("labels the week, hides names and keeps answered vision questions", () => {
    expect(weekLabels("2026-10-19", ["2026-10-25"], "2026-10-18", staff.matchDays)).toMatchObject({
      "2026-10-19": "MD+1",
      "2026-10-20": "MD+2",
      "2026-10-22": "MD-3",
      "2026-10-25": "MD",
    });

    const firstTheme = staff.vision.themas[0]!;
    const firstQuestion = firstTheme.vragen[0]!;
    const context = buildRoleContext({
      weekStart: "2026-10-19",
      trainings: [{ date: "2026-10-22", start: "19:30", duration_min: 90 }],
      matches: [{ date: "2026-10-25", start: "15:00", opponent: "X", home: false }],
      previousMatchDate: "2026-10-18",
      notes: null,
      players: [
        {
          id: "p9",
          shirt_number: 9,
          primary_position: "ST",
          secondary_positions: ["RW"],
          preferred_foot: "right",
          status: "injured",
          expected_return_date: "2026-11-01",
          archived_at: null,
        },
      ],
      visionSummary: "Hoge druk.",
      visionAnswers: { [`${firstTheme.id}.${firstQuestion.id}`]: "4-3-3" },
      questionnaire: staff.vision,
      matchDays: staff.matchDays,
      periodization: staff.periodization,
      season: { competitionStartDate: "2026-09-06", periodizationWeeks: 4 },
      tests: staff.tests,
      testResults: [
        { player_id: "p9", test_code: "vameval", test_date: "2026-08-20", result: 15.5 },
        { player_id: "p9", test_code: "vameval", test_date: "2026-09-01", result: 16 },
      ],
      history: [],
      opponent: null,
      evaluations: [],
      staff: { "physical-coach": { weektype: "deload" } },
      feedback: null,
    });

    expect(context.weekinput.dagen[3]).toMatchObject({
      datum: "2026-10-22",
      weekdag: "donderdag",
      md: "MD-3",
      training: { aanvang: "19:30", duur_min: 90 },
    });
    expect(context.kern).toEqual([
      {
        rugnummer: 9,
        posities: ["ST", "RW"],
        voet: "rechts",
        beschikbaar: false,
        status: "geblesseerd",
        terug_verwacht: "2026-11-01",
        mas_kmh: 16,
        mas_test_datum: "2026-09-01",
      },
    ]);
    expect(context.weekinput.periodisering).toMatchObject({ fase: "competitie", week_in_cyclus: 4 });
    expect(context.testen[0]).toMatchObject({ test: "vameval", laatste_test: "2026-09-01", nieuwe_test_nodig: false });
    expect(context.staf).toEqual({ "physical-coach": { weektype: "deload" } });
    expect(JSON.stringify(context)).not.toMatch(/first_name|last_name/);
    expect(context.visie.antwoorden).toEqual([
      { thema: firstTheme.titel, vraag: firstQuestion.vraag, antwoord: "4-3-3" },
    ]);
  });
});

describe("loadHistory", () => {
  it("sums the actual training load per week", () => {
    expect(sessionAu(5.5, 80)).toBe(440);
    const history = loadHistory(
      [{ week_start: "2026-10-12", weektype: "extensief", planned_au: 1300 }],
      [
        { session_date: "2026-10-13", kind: "training", rpe: 5, duration_min: 80, attendance: 18 },
        { session_date: "2026-10-15", kind: "training", rpe: 7, duration_min: 90, attendance: 17 },
        { session_date: "2026-10-18", kind: "match", rpe: 8, duration_min: 95, attendance: null },
        { session_date: "2026-10-20", kind: "training", rpe: 4, duration_min: 60, attendance: null },
      ],
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ gepland_au: 1300, werkelijk_au: 400 + 630 });
    expect(history[0]!.sessies).toHaveLength(3);
  });
});
