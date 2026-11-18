/**
 * Vertical layout of a lineup slide. A formation puts lines close together
 * (a keeper at 90, centre backs at 75, a holding midfielder at 57), which is
 * fine on a flat pitch but too tight for a shirt with a name (and first name)
 * below it. The players are grouped in lines and the lines are spread over
 * the pitch with enough room for every label; small offsets within a line
 * (full backs a bit higher, a deeper midfielder) stay visible.
 *
 * All values in slide pixels except the formation and result y (0..100).
 */

/** Screen y of the pitch at formation y 0 and the pixels per unit. */
export const PITCH_TOP = 150;
export const PITCH_UNIT = 5.7;

/** Slots whose y differs at most this much belong to the same line. */
const LINE_SPAN = 10;
/** Pixels per formation unit for offsets within a line. */
const OFFSET_PX = 2.5;
/** Screen y of the first line and the lowest line. */
const FIRST_LINE = 235;
const LAST_LINE = 708;
/**
 * Room a player needs from his y to the shirt of the line below: the label
 * under the shirt plus the part of the next shirt above its y.
 */
const NEED_WITH_DETAIL = 136;
const NEED_NAME_ONLY = 112;

export type LineupLayout = {
  /** Display y per player (same order as the input), 0..100+. */
  ys: number[];
  /** Scale for the shirts and labels (1 unless the lines are tight). */
  scale: number;
};

export function layoutLineup(
  ys: number[],
  { withDetail }: { withDetail: boolean },
): LineupLayout {
  if (ys.length === 0) return { ys: [], scale: 1 };
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const lines: { min: number; members: { y: number; i: number }[] }[] = [];
  for (const p of order) {
    const line = lines[lines.length - 1];
    if (line && p.y - line.min <= LINE_SPAN) line.members.push(p);
    else lines.push({ min: p.y, members: [p] });
  }
  const spread = lines.map(
    (l) => (Math.max(...l.members.map((m) => m.y)) - l.min) * OFFSET_PX,
  );
  const need = withDetail ? NEED_WITH_DETAIL : NEED_NAME_ONLY;
  const available = LAST_LINE - FIRST_LINE;
  const spreads = spread.reduce((a, b) => a + b, 0);
  const gaps = lines.length - 1;
  const required = spreads + gaps * need;
  const scale = required > available ? Math.max(0.75, available / required) : 1;
  const gap =
    gaps === 0 ? 0 : Math.max(need * scale, (available - spreads * scale) / gaps);

  const out = new Array<number>(ys.length);
  let base = gaps === 0 ? (FIRST_LINE + LAST_LINE) / 2 : FIRST_LINE;
  lines.forEach((line, li) => {
    for (const m of line.members) {
      const sy = base + (m.y - line.min) * OFFSET_PX * scale;
      out[m.i] = (sy - PITCH_TOP) / PITCH_UNIT;
    }
    base += spread[li]! * scale + gap;
  });
  return { ys: out, scale };
}
