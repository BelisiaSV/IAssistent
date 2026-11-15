import Link from "next/link";

import { EmptyState } from "@/components/card";
import { TaskProgress } from "@/components/staff/task-progress";
import { TaskProposalCard } from "@/components/staff/task-proposal-card";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { MESSAGE_COLUMNS, taskProposals, toChatMessage } from "@/lib/staff-room/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

const m = messages.tasksPage;

/** Taken: the joint tasks the staff proposed, with the roles involved. */
export default async function TasksPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{m.intro}</p>
      </div>
      {!tasks.length ? (
        <EmptyState text={messages.staffRoom.noTasks} href={`/teams/${team.id}/staff-room`} link={messages.nav.staffRoom} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {tasks.map((t) => (
            <li key={t.id} className="space-y-2">
              <TaskProposalCard task={t.task} roleNames={roleNames} owner={t.role} showOwner />
              <TaskProgress step={0} />
              <p className="flex items-center justify-between px-1 text-xs text-slate-500">
                <span>{m.status}</span>
                <Link href={`/teams/${team.id}/staff-room?rol=${t.role}`} className="font-medium text-brand hover:underline">
                  {m.open} →
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
