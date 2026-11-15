import type { CollaborationOutput, CollaborationPhase } from "@iassistent/staff-engine/content";

export type TaskStatus = "running" | "ready" | "failed" | "approved";
export type StepStatus = "pending" | "generating" | "ready" | "failed";

/** A step of a joint task as the app shows it. */
export interface TaskStepView {
  id: string;
  position: number;
  role: string;
  phase: CollaborationPhase;
  status: StepStatus;
  output: CollaborationOutput | null;
  provider: string;
}

/** A joint task with the steps of its current version and the final proposals of earlier versions. */
export interface TaskView {
  id: string;
  teamId: string;
  sourceMessageId: string;
  ownerRole: string;
  roles: string[];
  title: string;
  assignment: string;
  status: TaskStatus;
  version: number;
  feedback: string | null;
  createdAt: string;
  decidedAt: string | null;
  steps: TaskStepView[];
  earlier: { version: number; final: CollaborationOutput | null }[];
}

/** The steps of a task: a contribution of every involved role, then the final proposal of the owner. */
export function plannedSteps(owner: string, roles: readonly string[]) {
  const contributors = [...new Set(roles)].filter((r) => r !== owner);
  return [
    ...contributors.map((role, i) => ({ position: i + 1, role, phase: "bijdrage" as const })),
    { position: contributors.length + 1, role: owner, phase: "eindvoorstel" as const },
  ];
}

/** The next step to run: the first pending step whose earlier steps are all ready. */
export function nextStep<T extends { position: number; status: StepStatus }>(steps: readonly T[]): T | null {
  const ordered = steps.toSorted((a, b) => a.position - b.position);
  for (const step of ordered) {
    if (step.status === "ready") continue;
    return step.status === "pending" ? step : null;
  }
  return null;
}

/** Status of a task from the steps of its current version. */
export function statusFromSteps(steps: readonly { status: StepStatus }[]): Exclude<TaskStatus, "approved"> {
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.length && steps.every((s) => s.status === "ready")) return "ready";
  return "running";
}

/**
 * Where a task stands on the progress bar: 0 proposed, 1 confirmed,
 * 2 in progress, 3 waiting for approval, 4 approved.
 */
export function progressStep(status: TaskStatus | null): number {
  if (!status) return 0;
  return { running: 2, failed: 2, ready: 3, approved: 4 }[status];
}

/** A stored step output, or null when it is missing or malformed. */
export function stepOutput(raw: unknown): CollaborationOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.samenvatting !== "string" || typeof o.inhoud !== "string") return null;
  return {
    samenvatting: o.samenvatting,
    inhoud: o.inhoud,
    aandachtspunten: Array.isArray(o.aandachtspunten) ? o.aandachtspunten.filter((p): p is string => typeof p === "string") : [],
  };
}

type TaskRow = {
  id: string;
  team_id: string;
  source_message_id: string;
  owner_role: string;
  roles: string[];
  title: string;
  assignment: string;
  status: TaskStatus;
  version: number;
  feedback: string | null;
  created_at: string;
  decided_at: string | null;
};
type StepRow = {
  id: string;
  version: number;
  position: number;
  role: string;
  phase: CollaborationPhase;
  status: StepStatus;
  output: unknown;
  provider: string;
};

export function toTaskView(task: TaskRow, steps: readonly StepRow[]): TaskView {
  const finalOf = (version: number) => stepOutput(steps.find((s) => s.version === version && s.phase === "eindvoorstel")?.output);
  return {
    id: task.id,
    teamId: task.team_id,
    sourceMessageId: task.source_message_id,
    ownerRole: task.owner_role,
    roles: task.roles,
    title: task.title,
    assignment: task.assignment,
    status: task.status,
    version: task.version,
    feedback: task.feedback,
    createdAt: task.created_at,
    decidedAt: task.decided_at,
    steps: steps
      .filter((s) => s.version === task.version)
      .toSorted((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, position: s.position, role: s.role, phase: s.phase, status: s.status, output: stepOutput(s.output), provider: s.provider })),
    earlier: Array.from({ length: task.version - 1 }, (_, i) => task.version - 1 - i).map((version) => ({ version, final: finalOf(version) })),
  };
}

/** The final proposal of the current version, if ready. */
export function finalProposal(task: TaskView): CollaborationOutput | null {
  return task.steps.find((s) => s.phase === "eindvoorstel" && s.status === "ready")?.output ?? null;
}

export const TASK_COLUMNS = "id, team_id, source_message_id, owner_role, roles, title, assignment, status, version, feedback, created_at, decided_at";
export const STEP_COLUMNS = "id, version, position, role, phase, status, output, provider, updated_at";
