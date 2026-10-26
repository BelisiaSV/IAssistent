/**
 * Perspective for the animated pitch: maps field metres (x across, y along,
 * y 0 = far end) onto a trapezoid whose far end is `tilt` times as wide as the
 * near end, with the matching foreshortening (projective map, Heckbert).
 */
export interface Projection {
  /** Field metres → drawing coordinates. */
  p: (x: number, y: number) => { x: number; y: number };
  /** Local scale at a point (1 at the near end), for token sizes. */
  scale: (x: number, y: number) => number;
}

export function projection(W: number, L: number, tilt: number): Projection {
  if (tilt >= 0.999) {
    return { p: (x, y) => ({ x, y }), scale: () => 1 };
  }
  // Corners of the trapezoid: far end narrower and a bit shorter overall.
  const inset = (W * (1 - tilt)) / 2;
  const height = L * (1 - 0.45 * (1 - tilt));
  const [x0, y0, x1, y1, x2, y2, x3, y3] = [inset, 0, W - inset, 0, W, height, 0, height];
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const p = (x: number, y: number) => {
    const u = x / W;
    const v = y / L;
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + x0) / w, y: (d * u + e * v + y0) / w };
  };
  const near = Math.hypot(p(1, L).x - p(0, L).x, p(1, L).y - p(0, L).y);
  const scale = (x: number, y: number) => {
    const q0 = p(x, y);
    const q1 = p(x + 1, y);
    return Math.hypot(q1.x - q0.x, q1.y - q0.y) / near;
  };
  return { p, scale };
}

/** Points of a circle arc in field metres (angles in radians). */
export function arc(cx: number, cy: number, r: number, from = 0, to = Math.PI * 2, steps = 48) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number];
  });
}

/** Points of a quadratic Bézier curve. */
export function quad(a: [number, number], c: [number, number], b: [number, number], steps = 24) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const m = 1 - t;
    return [m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]] as [number, number];
  });
}
