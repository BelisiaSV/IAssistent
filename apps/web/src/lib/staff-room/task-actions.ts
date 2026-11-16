"use server";

import { canCollaborate, runCollaboration, StaffGenerationError } from "@iassistent/staff-engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffProvider } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { teamContextForChat } from "./context";
import {
  nextStep,
  plannedSteps,
  STEP_COLUMNS,
  statusFromSteps,
  stepOutput,
  TASK_COLUMNS,
  type TaskView,
  toTaskView,
} from "./tasks";
import { taskProposal } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type TaskResult = { task: TaskView; error?: string } | { task?: undefined; error: string };

const e = messages.tasksPage.errors;
const uuid = z.uuid();
/** A step still generating this long after it started is considered lost. */
const STALE_MS = 20 * 60 * 1000;

async function loadTask(supabase: Supabase, taskId: string): Promise<TaskView | null> {
  const [{ data: task }, { data: steps }] = await Promise.all([
    supabase.from("staff_tasks").select(TASK_COLUMNS).eq("id", taskId).maybeSingle(),
    supabase.from("staff_task_steps").select(STEP_COLUMNS).eq("task_id", taskId),
  ]);
  return task ? toTaskView(task, steps ?? []) : null;
}

function refresh(task: { teamId: string; id: string }) {
  revalidatePath(`/teams/${task.teamId}/tasks`);
  revalidatePath(`/teams/${task.teamId}/tasks/${task.id}`);
}

/** Inserts the steps of a version of a task (all pending). */
async function insertSteps(supabase: Supabase, task: { id: string; team_id: string; owner_role: string; roles: string[] }, version: number) {
  const provider = getStaffProvider();
  const { error } = await supabase.from("staff_task_steps").insert(
    plannedSteps(task.owner_role, task.roles).map((step) => ({
      task_id: task.id,
      team_id: task.team_id,
      version,
      position: step.position,
      role: step.role,
      phase: step.phase,
      provider: provider.id,
    })),
  );
  return error;
}

/**
 * The head coach confirms a task a role proposed in the Staff Room. The task
 * starts right away; the page moves it forward with advanceTask.
 */
export async function confirmTask(messageId: string): Promise<TaskResult> {
  if (!uuid.safeParse(messageId).success) return { error: e.confirm };
  await requireUser();
  const supabase = await createClient();
  const { data: message } = await supabase
    .from("staff_messages")
    .select("id, team_id, role, author, task_proposal")
    .eq("id", messageId)
    .maybeSingle();
  const proposal = message?.author === "role" ? taskProposal(message.task_proposal) : null;
  if (!message || !proposal) return { error: e.confirm };
  const roles = proposal.betrokken_rollen.filter((r) => r !== message.role && canCollaborate(staff, r));
  if (!roles.length || !canCollaborate(staff, message.role)) return { error: e.noRoles };

  const { data: task, error } = await supabase
    .from("staff_tasks")
    .insert({
      team_id: message.team_id,
      source_message_id: message.id,
      owner_role: message.role,
      roles,
      title: proposal.titel.slice(0, 120),
      assignment: proposal.opdracht.slice(0, 2000),
    })
    .select("id, team_id, owner_role, roles")
    .single();
  if (error || !task) {
    if (error?.code === "23505") {
      const { data: existing } = await supabase.from("staff_tasks").select("id").eq("source_message_id", message.id).maybeSingle();
      const view = existing ? await loadTask(supabase, existing.id) : null;
      if (view) return { task: view };
    }
    if (error?.code !== "42501") console.error("confirmTask failed", error);
    return { error: error?.code === "42501" ? e.readOnly : e.confirm };
  }
  const stepsError = await insertSteps(supabase, task, 1);
  if (stepsError) {
    await supabase.from("staff_tasks").update({ status: "failed" }).eq("id", task.id);
    if (stepsError.hint !== "daily_limit_reached") console.error("confirmTask: steps failed", stepsError);
  }
  const view = (await loadTask(supabase, task.id))!;
  refresh(view);
  return stepsError ? { task: view, error: stepsError.hint === "daily_limit_reached" ? e.dailyLimit : e.confirm } : { task: view };
}

/**
 * Runs the next step of a running task (one step per call, so each AI call
 * gets its own request). A step is claimed with a conditional update, so
 * concurrent calls never run it twice.
 */
export async function advanceTask(taskId: string): Promise<TaskResult> {
  if (!uuid.safeParse(taskId).success) return { error: e.load };
  const user = await requireUser();
  const supabase = await createClient();
  const { data: task } = await supabase.from("staff_tasks").select(TASK_COLUMNS).eq("id", taskId).maybeSingle();
  if (!task) return { error: e.load };
  if (task.status !== "running") return { task: (await loadTask(supabase, taskId))! };

  const { data: rows } = await supabase.from("staff_task_steps").select(STEP_COLUMNS).eq("task_id", taskId);
  let steps = (rows ?? []).filter((s) => s.version === task.version);

  // A step that never finished (e.g. the function was stopped) fails.
  const stale = steps.filter((s) => s.status === "generating" && Date.now() - new Date(s.updated_at).getTime() > STALE_MS);
  if (stale.length) {
    await supabase.from("staff_task_steps").update({ status: "failed" }).in("id", stale.map((s) => s.id));
    steps = steps.map((s) => (stale.includes(s) ? { ...s, status: "failed" as const } : s));
  }

  const step = nextStep(steps);
  if (step) {
    const { data: claimed } = await supabase
      .from("staff_task_steps")
      .update({ status: "generating" })
      .eq("id", step.id)
      .eq("status", "pending")
      .select("id");
    if (claimed?.length) {
      const result = await runStep(supabase, task, step, steps, rows ?? [], user.id);
      steps = steps.map((s) => (s.id === step.id ? { ...s, status: result } : s));
    }
  }

  const status = statusFromSteps(steps);
  if (status !== task.status && !steps.some((s) => s.status === "generating")) {
    await supabase.from("staff_tasks").update({ status }).eq("id", task.id).eq("status", "running");
  }
  const view = (await loadTask(supabase, taskId))!;
  if (view.status !== "running") refresh(view);
  return { task: view };
}

async function runStep(
  supabase: Supabase,
  task: { id: string; team_id: string; owner_role: string; roles: string[]; title: string; assignment: string; version: number; feedback: string | null; source_message_id: string },
  step: { id: string; role: string; phase: "bijdrage" | "eindvoorstel"; position: number },
  steps: { role: string; phase: string; position: number; status: string; output: unknown }[],
  all: { version: number; phase: string; output: unknown }[],
  coachId: string,
): Promise<"ready" | "failed"> {
  try {
    const [{ data: team }, { data: source }] = await Promise.all([
      supabase.from("teams").select("*").eq("id", task.team_id).single(),
      supabase.from("staff_messages").select("content").eq("id", task.source_message_id).maybeSingle(),
    ]);
    if (!team) throw new Error("team not found");
    const previous = stepOutput(all.find((s) => s.version === task.version - 1 && s.phase === "eindvoorstel")?.output);
    const result = await runCollaboration(
      staff,
      step.role,
      {
        teamcontext: await teamContextForChat(supabase, team, coachId),
        taak: {
          titel: task.title,
          opdracht: task.assignment,
          eigenaar: task.owner_role,
          betrokken_rollen: task.roles,
          aanleiding: source?.content ?? "",
        },
        fase: step.phase,
        bijdragen: steps
          .filter((s) => s.phase === "bijdrage" && s.position < step.position && s.status === "ready")
          .flatMap((s) => {
            const output = stepOutput(s.output);
            return output ? [{ rol: s.role, ...output }] : [];
          }),
        feedback: previous && task.feedback ? { vorige_versie: previous, feedback: task.feedback } : null,
      },
      getStaffProvider(),
    );
    await supabase
      .from("staff_task_steps")
      .update({ status: "ready", output: { ...result.output }, provider: result.provider })
      .eq("id", step.id);
    return "ready";
  } catch (err) {
    console.error("advanceTask: step failed", err instanceof StaffGenerationError ? err.code : err);
    await supabase.from("staff_task_steps").update({ status: "failed" }).eq("id", step.id);
    return "failed";
  }
}

/** The head coach approves the final proposal of a task. */
export async function approveTask(taskId: string): Promise<TaskResult> {
  if (!uuid.safeParse(taskId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_tasks")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("status", "ready")
    .select("id");
  if (error || !data?.length) {
    if (error && error.code !== "42501") console.error("approveTask failed", error);
    return { error: e.save };
  }
  const view = (await loadTask(supabase, taskId))!;
  refresh(view);
  return { task: view };
}

/**
 * The head coach asks for an adjustment: a new version in which every role
 * works again, with the previous final proposal and the feedback.
 */
export async function adjustTask(taskId: string, feedback: string): Promise<TaskResult> {
  const text = feedback.trim();
  if (!uuid.safeParse(taskId).success) return { error: e.save };
  if (!text) return { error: e.feedback };
  if (text.length > 2000) return { error: e.feedbackTooLong };
  await requireUser();
  const supabase = await createClient();
  const { data: task } = await supabase.from("staff_tasks").select("id, team_id, owner_role, roles, version, status").eq("id", taskId).maybeSingle();
  if (!task || !["ready", "approved", "failed"].includes(task.status)) return { error: e.save };

  const version = task.version + 1;
  const { data: updated, error } = await supabase
    .from("staff_tasks")
    .update({ version, feedback: text, status: "running", decided_at: null })
    .eq("id", task.id)
    .eq("version", task.version)
    .select("id");
  if (error || !updated?.length) {
    if (error && error.code !== "42501") console.error("adjustTask failed", error);
    return { error: e.save };
  }
  const stepsError = await insertSteps(supabase, task, version);
  if (stepsError) {
    await supabase.from("staff_tasks").update({ status: "failed" }).eq("id", task.id);
    if (stepsError.hint !== "daily_limit_reached") console.error("adjustTask: steps failed", stepsError);
    const view = (await loadTask(supabase, taskId))!;
    return { task: view, error: stepsError.hint === "daily_limit_reached" ? e.dailyLimit : e.save };
  }
  return { task: (await loadTask(supabase, taskId))! };
}

/** Runs the failed steps of the current version again. */
export async function retryTask(taskId: string): Promise<TaskResult> {
  if (!uuid.safeParse(taskId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { data: task } = await supabase.from("staff_tasks").select("id, version, status").eq("id", taskId).maybeSingle();
  if (!task || task.status !== "failed") return { error: e.save };
  const { data: steps } = await supabase.from("staff_task_steps").select("id").eq("task_id", taskId).eq("version", task.version);
  if (!steps?.length) {
    // The steps of this version were never stored (e.g. the daily limit): store them now.
    const { data: full } = await supabase.from("staff_tasks").select("id, team_id, owner_role, roles").eq("id", taskId).single();
    const stepsError = full ? await insertSteps(supabase, full, task.version) : null;
    if (!full || stepsError) return { error: stepsError?.hint === "daily_limit_reached" ? e.dailyLimit : e.save };
  } else {
    await supabase.from("staff_task_steps").update({ status: "pending" }).eq("task_id", taskId).eq("version", task.version).eq("status", "failed");
  }
  const { error } = await supabase.from("staff_tasks").update({ status: "running" }).eq("id", taskId).eq("status", "failed");
  if (error) return { error: e.save };
  return { task: (await loadTask(supabase, taskId))! };
}
