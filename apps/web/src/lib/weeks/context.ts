import type { Tables } from "@iassistent/db";
import {
  type LoadHistoryWeek,
  matchDayFor,
  type MatchDayCatalog,
  type PeriodizationCatalog,
  type RoleContext,
  type TestCatalog,
  testDue,
  weekPeriodization,
  visionAnswerKey,
  type VisionAnswers,
  type VisionQuestionnaire,
} from "@iassistent/staff-engine/content";

import { messages } from "@/lib/messages";

import { weekdayName, weekDates } from "./dates";
import type { WeekMatch, WeekTraining } from "./validation";

/** Match-day label per date of the week (null when far from any match). */
export function weekLabels(
  weekStart: string,
  matchDates: string[],
  previousMatchDate: string | null,
  catalog: MatchDayCatalog,
): Record<string, string | null> {
  const around = previousMatchDate ? [previousMatchDate, ...matchDates] : matchDates;
  return Object.fromEntries(
    weekDates(weekStart).map((date) => [date, matchDayFor(date, around, catalog)?.code ?? null]),
  );
}

type Player = Pick<
  Tables<"players">,
  "id" | "shirt_number" | "primary_position" | "secondary_positions" | "preferred_foot" | "status" | "expected_return_date" | "archived_at"
>;

/**
 * Everything the staff role gets about the week. No player names leave the app:
 * players are identified by shirt number only.
 */
export function buildRoleContext(input: {
  weekStart: string;
  trainings: WeekTraining[];
  matches: WeekMatch[];
  previousMatchDate: string | null;
  notes: string | null;
  players: Player[];
  visionSummary: string | null;
  visionAnswers: VisionAnswers;
  questionnaire: VisionQuestionnaire;
  matchDays: MatchDayCatalog;
  periodization: PeriodizationCatalog;
  season: { competitionStartDate: string | null; periodizationWeeks: number };
  tests: TestCatalog;
  /** Latest result per player and test code. */
  testResults: { player_id: string; test_code: string; test_date: string; result: number }[];
  history: LoadHistoryWeek[];
  staff: Record<string, unknown>;
  feedback: { previousOutput: unknown; comment: string } | null;
}): RoleContext {
  const labels = weekLabels(
    input.weekStart,
    input.matches.map((m) => m.date),
    input.previousMatchDate,
    input.matchDays,
  );

  const dagen = weekDates(input.weekStart).map((datum) => {
    const training = input.trainings.find((t) => t.date === datum);
    const match = input.matches.find((m) => m.date === datum);
    return {
      datum,
      weekdag: weekdayName(datum),
      md: labels[datum] ?? null,
      training: training ? { aanvang: training.start, duur_min: training.duration_min } : null,
      wedstrijd: match ? { aanvang: match.start, tegenstander: match.opponent, thuis: match.home } : null,
    };
  });

  const latest = latestResults(input.testResults);
  const mas = (playerId: string) => latest.get(`${playerId}:vameval`) ?? null;

  const kern = input.players
    .filter((p) => !p.archived_at)
    .sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999))
    .map((p) => ({
      rugnummer: p.shirt_number,
      posities: [p.primary_position, ...p.secondary_positions].filter((c): c is string => !!c),
      voet: p.preferred_foot ? messages.players.foot[p.preferred_foot].toLowerCase() : null,
      beschikbaar: p.status === "available",
      status: messages.players.status[p.status].toLowerCase(),
      terug_verwacht: p.status === "injured" ? p.expected_return_date : null,
      mas_kmh: mas(p.id)?.result ?? null,
      mas_test_datum: mas(p.id)?.test_date ?? null,
    }));

  const activeIds = new Set(input.players.filter((p) => !p.archived_at).map((p) => p.id));
  const testen = input.tests.testen.map((test) => {
    const results = [...latest.entries()].filter(
      ([key, r]) => key.endsWith(`:${test.code}`) && activeIds.has(r.player_id),
    );
    const last = results.map(([, r]) => r.test_date).sort().at(-1) ?? null;
    return {
      test: test.code,
      naam: test.naam,
      laatste_test: last,
      interval_weken: test.interval_weken,
      nieuwe_test_nodig: testDue(last, input.weekStart, test.interval_weken),
      spelers_met_resultaat: results.length,
    };
  });

  const antwoorden = input.questionnaire.themas.flatMap((theme) =>
    theme.vragen.flatMap((vraag) => {
      const antwoord = input.visionAnswers[visionAnswerKey(theme.id, vraag.id)];
      return antwoord === undefined ? [] : [{ thema: theme.titel, vraag: vraag.vraag, antwoord }];
    }),
  );

  return {
    weekinput: {
      week_van: input.weekStart,
      periodisering: weekPeriodization(
        input.weekStart,
        input.season.competitionStartDate,
        input.season.periodizationWeeks,
        input.periodization,
      ),
      vorige_wedstrijd: input.previousMatchDate,
      notitie: input.notes,
      dagen,
    },
    kern,
    visie: { samenvatting: input.visionSummary, antwoorden },
    belastingshistoriek: input.history,
    testen,
    staf: input.staff,
    feedback: input.feedback
      ? { vorige_versie: input.feedback.previousOutput, feedback: input.feedback.comment }
      : null,
  };
}

function latestResults(rows: { player_id: string; test_code: string; test_date: string; result: number }[]) {
  const latest = new Map<string, { player_id: string; test_date: string; result: number }>();
  for (const row of rows) {
    const key = `${row.player_id}:${row.test_code}`;
    const current = latest.get(key);
    if (!current || current.test_date < row.test_date) {
      latest.set(key, { player_id: row.player_id, test_date: row.test_date, result: Number(row.result) });
    }
  }
  return latest;
}

/** AU of a session: average RPE of the group × duration in minutes. */
export const sessionAu = (rpe: number, durationMin: number) => Math.round(rpe * durationMin);

/** Load history per week (planned AU from the approved load plan, actual AU from RPE). */
export function loadHistory(
  weeks: { week_start: string; weektype: string | null; planned_au: number | null }[],
  sessions: { session_date: string; kind: "training" | "match"; rpe: number; duration_min: number; attendance: number | null }[],
): LoadHistoryWeek[] {
  return weeks.map((week) => {
    const end = addDaysIso(week.week_start, 7);
    const sessies = sessions
      .filter((s) => s.session_date >= week.week_start && s.session_date < end)
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .map((s) => ({
        datum: s.session_date,
        soort: s.kind === "match" ? ("wedstrijd" as const) : ("training" as const),
        rpe: Number(s.rpe),
        duur_min: s.duration_min,
        au: sessionAu(Number(s.rpe), s.duration_min),
        aanwezigen: s.attendance,
      }));
    const trainings = sessies.filter((s) => s.soort === "training");
    return {
      week_van: week.week_start,
      weektype: week.weektype,
      gepland_au: week.planned_au,
      werkelijk_au: trainings.length ? trainings.reduce((sum, s) => sum + s.au, 0) : null,
      sessies,
    };
  });
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
