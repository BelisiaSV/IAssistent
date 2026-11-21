import "server-only";

import type { Json } from "@iassistent/db";
import { runQualityCheck, StaffGenerationError } from "@iassistent/staff-engine";

import { getStaffProvider } from "@/lib/ai";
import { clubDnaForTeam } from "@/lib/clubs/dna";
import { staff } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { contextForRole, loadWeek } from "@/lib/weeks/load";
import type { SeasonTeam } from "@/lib/weeks/season";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Steps of a week run whose work is checked (the drawings of the exercises are not). */
export const QUALITY_STEPS = ["pc", "tc", "ac"] as const;

export type QualityCheckResult = { ok: true } | { ok: false; error: "not_ready" | "daily_limit" | "failed" };

/**
 * Training Quality Engine: checks a week run of the staff against the criteria
 * in /staff and stores the result (also when it fails). The context is the one
 * the staff got: vision with the club DNA, the week and the squad without names.
 */
export async function checkRunQuality(
  supabase: Supabase,
  input: {
    team: SeasonTeam;
    weekStart: string;
    runId: string;
    coachId: string;
    /** The run's last step just finished; its status still says generating. */
    finishing?: boolean;
  },
): Promise<QualityCheckResult> {
  const { data: run } = await supabase
    .from("staff_runs")
    .select("id, team_id, kind, status, feedback, deleted_at")
    .eq("id", input.runId)
    .eq("team_id", input.team.id)
    .maybeSingle();
  if (!run || run.kind !== "week" || run.deleted_at || !(input.finishing ? ["generating"] : ["ready", "approved"]).includes(run.status)) {
    return { ok: false, error: "not_ready" };
  }
  const provider = getStaffProvider();

  // Do not spend an AI call that the database would refuse to store.
  if (provider.id !== "example") {
    const { data: remaining } = await supabase.rpc("staff_quality_remaining_today");
    if (remaining === 0) return { ok: false, error: "daily_limit" };
  }

  const [data, { data: proposals }, { data: profile }, { data: teamRow }] = await Promise.all([
    loadWeek(supabase, input.team, input.weekStart),
    supabase.from("staff_proposals").select("step, role, output").eq("run_id", run.id),
    supabase.from("coach_profiles").select("vision_summary, vision").eq("coach_id", input.coachId).maybeSingle(),
    supabase.from("teams").select("club_id, age_category").eq("id", input.team.id).maybeSingle(),
  ]);
  const clubDna = teamRow ? await clubDnaForTeam(supabase, teamRow, input.weekStart) : null;

  const base = { team_id: input.team.id, run_id: run.id, provider: provider.id };
  try {
    const context = contextForRole(data, input.weekStart, {
      staff: {},
      vision: profile ? { summary: profile.vision_summary, vision: profile.vision } : null,
      feedback: null,
      clubDna,
    });
    const voorstel: Record<string, unknown> = Object.fromEntries(
      (proposals ?? []).flatMap((p) =>
        p.output && (QUALITY_STEPS as readonly string[]).includes(p.step ?? "") ? [[p.role, p.output]] : [],
      ),
    );
    voorstel.feedback = run.feedback;
    const result = await runQualityCheck(
      staff,
      { visie: context.visie, weekinput: context.weekinput, kern: context.kern, voorstel },
      provider,
    );
    const { error } = await supabase.from("training_quality_reviews").insert({
      ...base,
      status: "ready",
      output: result.output as unknown as Json,
      average: result.average,
      verdict: result.verdict,
      model: result.model,
      usage: result.usage as Json,
      content_version: result.contentVersion,
    });
    if (error) {
      if (error.hint === "daily_limit_reached") return { ok: false, error: "daily_limit" };
      throw error;
    }
    return { ok: true };
  } catch (cause) {
    console.error("quality check failed", cause);
    const detail = cause instanceof StaffGenerationError ? `${cause.code}: ${cause.message}` : String(cause);
    await supabase.from("training_quality_reviews").insert({ ...base, status: "failed", error: detail.slice(0, 2000) });
    return { ok: false, error: "failed" };
  }
}
