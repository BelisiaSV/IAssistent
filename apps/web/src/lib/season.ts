/** Belgian football seasons run from July to June: season 2026 = 2026-2027. */
const SEASON_START_MONTH = 6; // July (0-based)

export function currentSeasonStartYear(today = new Date()): number {
  return today.getMonth() >= SEASON_START_MONTH ? today.getFullYear() : today.getFullYear() - 1;
}

export function formatSeason(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

/** Number of seasons at the club, counting the current one. */
export function seasonsAtClub(joinedSeasonStartYear: number, today = new Date()): number {
  return Math.max(1, currentSeasonStartYear(today) - joinedSeasonStartYear + 1);
}
