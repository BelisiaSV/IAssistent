import "server-only";

import type { QualityLabels } from "@/components/quality/quality-review";
import { staff } from "@/lib/staff";

/** Names of the criteria and verdicts of the Training Quality Engine, from /staff. */
export function qualityLabels(): QualityLabels {
  const q = staff.quality;
  return {
    criteria: Object.fromEntries(q.criteria.map((c) => [c.code, c.naam])),
    verdicts: Object.fromEntries(q.oordelen.map((o) => [o.code, o.label])),
    max: q.schaal.max,
  };
}
