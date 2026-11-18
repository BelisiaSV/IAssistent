/** The zones of the pitch an exercise is played in: 1–3 at the own goal up to 16–18 at the opponent's goal. */
export const ZONE_COUNT = 18;

/** The zones of an exercise (whole numbers 1–18, from its content). */
export function bankZones(row: { content: unknown }): number[] {
  const zones = (row.content as { zones?: unknown } | null)?.zones;
  return Array.isArray(zones)
    ? [...new Set(zones.filter((z): z is number => Number.isInteger(z) && z >= 1 && z <= ZONE_COUNT))].sort((a, b) => a - b)
    : [];
}
