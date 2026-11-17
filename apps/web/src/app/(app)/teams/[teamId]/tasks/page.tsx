import { canConverse, routeTask } from "@iassistent/staff-engine";

import { EmptyState } from "@/components/card";
import { CoachTaskList } from "@/components/staff/coach-task-list";
import { TaskProposalCard } from "@/components/staff/task-proposal-card";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { STAFF_ROOM_ROLES } from "@/lib/staff-room/roles";
import {
  MESSAGE_COLUMNS,
  taskProposals,
  toChatMessage,
} from "@/lib/staff-room/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

const m = messages.tasksPage;

/** Taken: the joint tasks of the staff, running and waiting for approval first. */
export default async function TasksPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data }, { data: mine }] = await Promise.all([
    supabase
      .from("staff_messages")
      .select(MESSAGE_COLUMNS)
      .eq("team_id", team.id)
      .not("task_proposal", "is", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("coach_tasks")
      .select("id, title, done, role, asked_at")
      .eq("team_id", team.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const roles = STAFF_ROOM_ROLES.filter((id) => canConverse(staff, id));
  const tasks = taskProposals((data ?? []).map(toChatMessage));
  const roleNames = Object.fromEntries(
    staff.roles.map((r) => [r.id, r.meta.naam]),
  );
  const sections = [
    {
      key: "active",
      items: tasks.filter(
        (t) => t.confirmed && t.confirmed.status !== "approved",
      ),
    },
    { key: "proposed", items: tasks.filter((t) => !t.confirmed) },
    {
      key: "approved",
      items: tasks.filter((t) => t.confirmed?.status === "approved"),
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      <CoachTaskList
        teamId={team.id}
        canWrite={canEdit}
        roles={roles}
        roleNames={roleNames}
        tasks={(mine ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          role: t.role,
          askedAt: t.asked_at,
          suggested: (() => {
            const routed = routeTask(staff.taskRouting, t.title);
            return (roles as string[]).includes(routed) ? routed : (roles[0] ?? routed);
          })(),
        }))}
      />
      <div>
        <h2 className="text-lg font-semibold">{m.staffTitle}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.staffIntro}</p>
      </div>
      {!tasks.length ? (
        <EmptyState
          text={messages.staffRoom.noTasks}
          href={`/teams/${team.id}/staff-room`}
          link={messages.nav.staffRoom}
        />
      ) : (
        sections
          .filter((section) => section.items.length)
          .map((section) => (
            <section key={section.key} className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {m.sections[section.key]}{" "}
                <span className="text-slate-400">({section.items.length})</span>
              </h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {section.items.map((t) => (
                  <li key={t.id}>
                    <TaskProposalCard
                      task={t.task}
                      roleNames={roleNames}
                      owner={t.role}
                      showOwner
                      messageId={t.id}
                      teamId={team.id}
                      confirmed={t.confirmed}
                      canWrite={canEdit}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
