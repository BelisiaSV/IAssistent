/**
 * From which day the head coach can ask for the match preparation: the day of
 * the last training before the first match of the week (or right away when the
 * week has no training before it). Null when the week has no match.
 */
export function matchPrepFrom(
  trainings: readonly { date: string }[],
  matches: readonly { date: string }[],
  weekStart: string,
): string | null {
  const match = matches.map((m) => m.date).sort()[0];
  if (!match) return null;
  return trainings.map((t) => t.date).filter((d) => d < match).sort().at(-1) ?? weekStart;
}
