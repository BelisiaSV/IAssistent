import type { ReactNode } from "react";

import { Badge } from "@/components/admin/rows";
import { messages } from "@/lib/messages";
import { shortDate } from "@/lib/weeks/dates";

const m = messages.development;
const TONE: Record<string, "slate" | "green" | "amber" | "sky"> = { open: "slate", on_track: "sky", at_risk: "amber", achieved: "green", dropped: "slate" };

/** Status, progress bar and target date of a goal, on one line. */
export function GoalMeta({ status, progress, targetDate }: { status: string; progress: number; targetDate: string | null }): ReactNode {
  return (
    <>
      <Badge tone={TONE[status] ?? "slate"}>{m.statuses[status] ?? status}</Badge>
      <span className="flex items-center gap-1.5" title={`${progress}%`}>
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
          <span className={`block h-full ${status === "achieved" ? "bg-emerald-500" : status === "at_risk" ? "bg-amber-400" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
        </span>
        <span className="tabular-nums">{progress}%</span>
      </span>
      {targetDate && <span>{m.until(shortDate(targetDate))}</span>}
    </>
  );
}
