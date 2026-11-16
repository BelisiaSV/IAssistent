import { notFound } from "next/navigation";
import { z } from "zod";

import { staff } from "@/lib/staff";
import { STEP_COLUMNS, TASK_COLUMNS, toTaskView } from "@/lib/staff-room/tasks";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { TaskDetail } from "./task-detail";

export default async function TaskPage({ params }: { params: Promise<{ teamId: string; taskId: string }> }) {
  const { teamId, taskId } = await params;
  if (!z.uuid().safeParse(taskId).success) notFound();
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: task }, { data: steps }] = await Promise.all([
    supabase.from("staff_tasks").select(TASK_COLUMNS).eq("id", taskId).eq("team_id", team.id).maybeSingle(),
    supabase.from("staff_task_steps").select(STEP_COLUMNS).eq("task_id", taskId),
  ]);
  if (!task) notFound();

  return (
    <TaskDetail
      initial={toTaskView(task, steps ?? [])}
      roleNames={Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]))}
      canWrite={canEdit}
    />
  );
}
