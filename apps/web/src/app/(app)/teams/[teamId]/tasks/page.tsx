import { canConverse, routeTask } from "@iassistent/staff-engine";

import { CoachTaskList } from "@/components/staff/coach-task-list";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { STAFF_ROOM_ROLES } from "@/lib/staff-room/roles";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

const m = messages.tasksPage;

/**
 * Taken: the to-dos of the head coach. The joint tasks of the staff run in
 * the background (Staff Room) and are not shown here.
 */
export default async function TasksPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("coach_tasks")
    .select("id, title, done, role, asked_at")
    .eq("team_id", team.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const roles: string[] = STAFF_ROOM_ROLES.filter((id) => canConverse(staff, id));
  const roleNames = Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]));
  const suggest = (title: string) => {
    const routed = routeTask(staff.taskRouting, title);
    return roles.includes(routed) ? routed : (roles[0] ?? routed);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
      </div>
      <CoachTaskList
        teamId={team.id}
        canWrite={canEdit}
        roles={roles}
        roleNames={roleNames}
        tasks={(mine ?? []).map((t) => ({ id: t.id, title: t.title, done: t.done, role: t.role, askedAt: t.asked_at, suggested: suggest(t.title) }))}
      />
    </div>
  );
}
