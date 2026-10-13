/** Distance per repetition in metres: MAS (km/h) → m/s × % MAS × work seconds. */
export function masDistance(masKmh: number, pct: number, seconds: number): number {
  return Math.round((masKmh / 3.6) * (pct / 100) * seconds);
}
