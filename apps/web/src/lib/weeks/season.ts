import type { Tables } from "@iassistent/db";
import type { SeasonPlan } from "@iassistent/staff-engine/content";

/** Team columns the week page and the staff need for the season planning. */
export const SEASON_TEAM_COLUMNS =
  "id, competition_start_date, periodization_weeks, preparation_start_date, preparation_weeks" as const;

export type SeasonTeam = Pick<
  Tables<"teams">,
  "id" | "competition_start_date" | "periodization_weeks" | "preparation_start_date" | "preparation_weeks"
>;

export function seasonPlan(team: SeasonTeam): SeasonPlan {
  return {
    preparationStart: team.preparation_start_date,
    preparationWeeks: team.preparation_weeks,
    competitionStart: team.competition_start_date,
    competitionWeeks: team.periodization_weeks,
  };
}
