import "server-only";

import type { Json } from "@iassistent/db";
import { notFound } from "next/navigation";

import type { WeekDocument } from "@/components/proposals/week-document-view";
import { loadWeekExercises } from "@/lib/exercises/week";
import { shirtNames } from "@/lib/proposals/names";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { isIsoDate, isoWeekday } from "./dates";
import { loadWeek } from "./load";
import type { WeekMatch } from "./validation";

/**
 * A finished version of the week document (the requested one, else the
 * approved one, else the latest) with everything the printable views need.
 */
export async function loadWeekDocument(teamId: string, weekStart: string, version: string | undefined) {
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const { team, logoUrl } = await getTeamContext(teamId);

  const supabase = await createClient();
  const data = await loadWeek(supabase, team, weekStart);
  const runs = data.runs.filter((x) => x.kind === "week" && ["ready", "approved", "rejected"].includes(x.status));
  const run = runs.find((x) => String(x.version) === version) ?? runs.find((x) => x.status === "approved") ?? runs[0];
  if (!run) notFound();

  const outputs = Object.fromEntries(
    data.proposals.filter((x) => x.run_id === run.id && x.output).map((x) => [x.step ?? "", x.output]),
  ) as Record<string, Json | undefined>;
  const doc = { pc: outputs.pc ?? null, tc: outputs.tc ?? null, ac: outputs.ac ?? null, tco: outputs.tco ?? null } as unknown as WeekDocument;
  const exercises = await loadWeekExercises(supabase, [outputs.ac, outputs.tc], team, logoUrl);

  return {
    team,
    logoUrl,
    data,
    run,
    doc,
    exercises,
    names: shirtNames(data.players),
    matches: (data.week?.matches ?? []) as WeekMatch[],
  };
}
