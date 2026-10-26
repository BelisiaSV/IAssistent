import "server-only";

import type { Json, Tables } from "@iassistent/db";
import { runRole, StaffGenerationError } from "@iassistent/staff-engine";

import { getStaffProvider } from "@/lib/ai";
import { LIBRARY_COLUMNS, LIBRARY_LIMIT, libraryExercise } from "@/lib/exercises/library";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { activeSteps, MATCH_USES_WEEK_STEPS, nextSteps, RUN_STEPS, type RunKind, type RunStep, runStatus, stepsToRerun } from "@/lib/roles";
import { staff } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { contextForRole, loadWeek } from "@/lib/weeks/load";
import type { SeasonTeam } from "@/lib/weeks/season";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Team = SeasonTeam;
type Proposal = Tables<"staff_proposals">;

/** A step still generating this long after the run started is considered lost. */
const STALE_MS = 20 * 60 * 1000;

export class RunRequestError extends Error {
  constructor(public readonly code: "no_week" | "no_steps" | "daily_limit" | "failed") {
    super(code);
  }
}

/** The steps of a run kind that are switched on for the signed-in coach. */
export async function enabledSteps(kind: RunKind): Promise<RunStep[]> {
  const flags = new Map(
    await Promise.all(
      [...new Set(RUN_STEPS[kind].map((s) => s.flag))].map(async (flag) => [flag, await isFeatureEnabled(flag)] as const),
    ),
  );
  return activeSteps(kind, (flag) => flags.get(flag) ?? false);
}

/**
 * Creates a run with one proposal per step. Steps the head coach did not ask
 * to change are copied from the run it adjusts; the others start as pending.
 */
export async function startRun(
  supabase: Supabase,
  input: {
    teamId: string;
    weekPlanId: string;
    kind: RunKind;
    feedback: string | null;
    feedbackStep: string | null;
    basedOn: Tables<"staff_runs"> | null;
    /** Retry a failed run: only the steps without output (and what builds on them) run again. */
    retry?: boolean;
  },
) {
  const steps = await enabledSteps(input.kind);
  if (!steps.length) throw new RunRequestError("no_steps");
  const provider = getStaffProvider();

  const { data: run, error } = await supabase
    .from("staff_runs")
    .insert({
      team_id: input.teamId,
      week_plan_id: input.weekPlanId,
      kind: input.kind,
      provider: provider.id,
      feedback: input.feedback,
      feedback_step: input.feedbackStep,
      based_on: input.basedOn?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !run) {
    if (error?.hint === "daily_limit_reached") throw new RunRequestError("daily_limit");
    console.error("startRun failed", error);
    throw new RunRequestError("failed");
  }

  const previous = input.basedOn
    ? ((await supabase.from("staff_proposals").select("*").eq("run_id", input.basedOn.id)).data ?? [])
    : [];
  const rerun = !input.basedOn
    ? new Set(steps.map((s) => s.key))
    : input.retry
      ? new Set(
          steps
            .filter((s) => !previous.some((p) => p.step === s.key && p.output))
            .flatMap((s) => [...stepsToRerun(steps, s.key)]),
        )
      : stepsToRerun(steps, input.feedbackStep);
  const rows = steps.map((step) => {
    const copy = !rerun.has(step.key) ? previous.find((p) => p.step === step.key && p.output) : undefined;
    const targeted = input.feedback && (!input.feedbackStep || input.feedbackStep === step.key);
    return {
      team_id: input.teamId,
      week_plan_id: input.weekPlanId,
      run_id: run.id,
      step: step.key,
      role: step.role,
      task: step.task,
      provider: copy?.provider ?? provider.id,
      status: copy ? ("ready" as const) : ("pending" as const),
      output: copy?.output ?? null,
      model: copy?.model ?? null,
      usage: copy?.usage ?? null,
      content_version: copy?.content_version ?? null,
      feedback: targeted ? input.feedback : null,
    };
  });
  const { error: stepsError } = await supabase.from("staff_proposals").insert(rows);
  if (stepsError) {
    console.error("startRun: steps failed", stepsError);
    await supabase.from("staff_runs").update({ status: "failed" }).eq("id", run.id);
    throw new RunRequestError("failed");
  }
  return run;
}

/**
 * Moves a run forward: starts every step whose earlier steps are ready. Each
 * step is claimed with a conditional update, so concurrent calls never run a
 * step twice. Returns the work to do; the caller runs it after the response.
 */
export async function advanceRun(
  supabase: Supabase,
  input: { team: Team; weekStart: string; runId: string; coachId: string },
): Promise<(() => Promise<void>) | null> {
  const { data: run } = await supabase.from("staff_runs").select("*").eq("id", input.runId).maybeSingle();
  if (!run || run.status !== "generating") return null;
  const steps = RUN_STEPS[run.kind];

  let { data: states } = await supabase.from("staff_proposals").select("*").eq("run_id", run.id);
  states = states ?? [];

  // A step that never finished (e.g. the function was stopped) fails the run.
  const stale = states.filter(
    (p) => p.status === "generating" && Date.now() - new Date(p.created_at).getTime() > STALE_MS,
  );
  if (stale.length) {
    await supabase
      .from("staff_proposals")
      .update({ status: "failed", error: "timeout" })
      .in("id", stale.map((p) => p.id));
    states = states.map((p) => (stale.includes(p) ? { ...p, status: "failed" as const } : p));
  }

  const status = runStatus(states.map((p) => ({ step: p.step ?? "", status: p.status })));
  if (status !== "generating") {
    await supabase.from("staff_runs").update({ status }).eq("id", run.id).eq("status", "generating");
    return null;
  }

  const runSteps = steps.filter((s) => states.some((p) => p.step === s.key));
  const ready = nextSteps(runSteps, states.map((p) => ({ step: p.step ?? "", status: p.status })));
  const claimed: { step: RunStep; proposal: Proposal }[] = [];
  for (const step of ready) {
    const proposal = states.find((p) => p.step === step.key)!;
    const { data } = await supabase
      .from("staff_proposals")
      .update({ status: "generating" })
      .eq("id", proposal.id)
      .eq("status", "pending")
      .select("id");
    if (data?.length) claimed.push({ step, proposal });
  }
  if (!claimed.length) return null;

  return async () => {
    const [data, { data: profile }, { data: exercises }, previousRun] = await Promise.all([
      loadWeek(supabase, input.team, input.weekStart),
      supabase.from("coach_profiles").select("vision_summary, vision").eq("coach_id", input.coachId).maybeSingle(),
      // The coach's own library (RLS: own exercises only).
      supabase
        .from("exercises")
        .select(LIBRARY_COLUMNS)
        .eq("use_in_planning", true)
        .order("updated_at", { ascending: false })
        .limit(LIBRARY_LIMIT),
      run.based_on
        ? supabase.from("staff_proposals").select("step, output").eq("run_id", run.based_on).then((r) => r.data ?? [])
        : Promise.resolve([]),
    ]);
    const provider = getStaffProvider();

    await Promise.all(
      claimed.map(async ({ step, proposal }) => {
        try {
          const staffOutputs = stepStaff(step, run.kind, states, data.proposals, data.runs);
          const previousOutput = previousRun.find((p) => p.step === step.key)?.output;
          const context = contextForRole(data, input.weekStart, {
            staff: staffOutputs,
            vision: profile ? { summary: profile.vision_summary, vision: profile.vision } : null,
            feedback: proposal.feedback && previousOutput ? { previousOutput, comment: proposal.feedback } : null,
            library: (exercises ?? []).map(libraryExercise),
          });
          const result = await runRole(staff, step.role, context, provider, step.task);
          const { error } = await supabase
            .from("staff_proposals")
            .update({
              status: "ready",
              output: result.output as Json,
              model: result.model,
              usage: result.usage as Json,
              content_version: result.contentVersion,
            })
            .eq("id", proposal.id);
          if (error) throw error;
        } catch (cause) {
          console.error(`staff run step ${step.key} failed`, cause);
          const detail = cause instanceof StaffGenerationError ? `${cause.code}: ${cause.message}` : String(cause);
          await supabase
            .from("staff_proposals")
            .update({ status: "failed", error: detail.slice(0, 2000) })
            .eq("id", proposal.id);
        }
      }),
    );

    // Close the run when everything is done; otherwise the page asks for the next steps.
    const { data: after } = await supabase.from("staff_proposals").select("step, status").eq("run_id", run.id);
    const final = runStatus((after ?? []).map((p) => ({ step: p.step ?? "", status: p.status })));
    if (final !== "generating") {
      await supabase.from("staff_runs").update({ status: final }).eq("id", run.id).eq("status", "generating");
    }
  };
}

/** "Staf" for a step: earlier steps of the same run, or the approved week document for the match preparation. */
function stepStaff(
  step: RunStep,
  kind: RunKind,
  runProposals: Proposal[],
  weekProposals: Proposal[],
  runs: Tables<"staff_runs">[],
): Record<string, unknown> {
  if (kind === "match") {
    const approvedWeek = runs.find((r) => r.kind === "week" && r.status === "approved");
    const source = weekProposals.filter((p) => p.run_id === approvedWeek?.id);
    return Object.fromEntries(
      MATCH_USES_WEEK_STEPS.flatMap((key) => {
        const p = source.find((x) => x.step === key && x.output);
        return p ? [[p.role, p.output]] : [];
      }),
    );
  }
  return Object.fromEntries(
    step.after.flatMap((key) => {
      const p = runProposals.find((x) => x.step === key);
      return p?.output ? [[p.role, p.output]] : [];
    }),
  );
}

/** Approves (or rejects) a run as a whole; its proposals follow. */
export async function decideRun(supabase: Supabase, run: Tables<"staff_runs">, decision: "approved" | "rejected") {
  const now = new Date().toISOString();
  if (decision === "approved") {
    // One approved run per week and kind, one approved proposal per role and task.
    await supabase
      .from("staff_runs")
      .update({ status: "ready", decided_at: null })
      .eq("week_plan_id", run.week_plan_id)
      .eq("kind", run.kind)
      .eq("status", "approved");
    const { data: proposals } = await supabase.from("staff_proposals").select("id, role, task").eq("run_id", run.id);
    for (const p of proposals ?? []) {
      await supabase
        .from("staff_proposals")
        .update({ status: "ready", decided_at: null })
        .eq("week_plan_id", run.week_plan_id)
        .eq("role", p.role)
        .eq("task", p.task)
        .eq("status", "approved");
    }
    await supabase
      .from("staff_proposals")
      .update({ status: "approved", decided_at: now })
      .eq("run_id", run.id)
      .eq("status", "ready");
  } else if (run.status === "approved") {
    await supabase.from("staff_proposals").update({ status: "ready", decided_at: null }).eq("run_id", run.id);
  }
  const { error } = await supabase.from("staff_runs").update({ status: decision, decided_at: now }).eq("id", run.id);
  if (error) console.error("decideRun failed", error);
}
