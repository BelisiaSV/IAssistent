import { EmptyState } from "@/components/card";
import { TaskProposalCard } from "@/components/staff/task-proposal-card";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { MESSAGE_COLUMNS, taskProposals, toChatMessage } from "@/lib/staff-room/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

const m = messages.tasksPage;

/** Taken: the joint tasks of the staff, running and waiting for approval first. */
export default async function TasksPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_messages")
    .select(MESSAGE_COLUMNS)
    .eq("team_id", team.id)
    .not("task_proposal", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  const tasks = taskProposals((data ?? []).map(toChatMessage));
  const roleNames = Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]));
  const sections = [
    { key: "active", items: tasks.filter((t) => t.confirmed && t.confirmed.status !== "approved") },
    { key: "proposed", items: tasks.filter((t) => !t.confirmed) },
    { key: "approved", items: tasks.filter((t) => t.confirmed?.status === "approved") },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      {!tasks.length ? (
        <EmptyState text={messages.staffRoom.noTasks} href={`/teams/${team.id}/staff-room`} link={messages.nav.staffRoom} />
      ) : (
        sections
          .filter((section) => section.items.length)
          .map((section) => (
            <section key={section.key} className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {m.sections[section.key]} <span className="text-slate-400">({section.items.length})</span>
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
