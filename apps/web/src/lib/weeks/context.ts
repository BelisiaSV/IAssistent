import type { Tables } from "@iassistent/db";
import {
  matchDayFor,
  type MatchDayCatalog,
  type RoleContext,
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
  "shirt_number" | "primary_position" | "secondary_positions" | "preferred_foot" | "status" | "expected_return_date" | "archived_at"
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
    }));

  const antwoorden = input.questionnaire.themas.flatMap((theme) =>
    theme.vragen.flatMap((vraag) => {
      const antwoord = input.visionAnswers[visionAnswerKey(theme.id, vraag.id)];
      return antwoord === undefined ? [] : [{ thema: theme.titel, vraag: vraag.vraag, antwoord }];
    }),
  );

  return {
    weekinput: {
      week_van: input.weekStart,
      vorige_wedstrijd: input.previousMatchDate,
      notitie: input.notes,
      dagen,
    },
    kern,
    visie: { samenvatting: input.visionSummary, antwoorden },
    feedback: input.feedback
      ? { vorige_versie: input.feedback.previousOutput, feedback: input.feedback.comment }
      : null,
  };
}
