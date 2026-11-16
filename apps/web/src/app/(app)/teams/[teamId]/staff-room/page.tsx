import { canConverse, meetingTurns } from "@iassistent/staff-engine";
import { z } from "zod";

import { getStaffProvider } from "@/lib/ai";
import { staff } from "@/lib/staff";
import { MEETING_COLUMNS, toMeetingView, TURN_COLUMNS } from "@/lib/staff-room/meetings";
import { isStaffRoomRole, STAFF_ROOM_ROLES } from "@/lib/staff-room/roles";
import { MESSAGE_COLUMNS, taskProposals, toChatMessage } from "@/lib/staff-room/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { StaffRoom } from "./staff-room";

/** Earlier assignments in the list on the right. */
const HISTORY = 30;

export default async function StaffRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ rol?: string; opdracht?: string }>;
}) {
  const [{ teamId }, { rol, opdracht }] = await Promise.all([params, searchParams]);
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: meetings }, { data: proposals }] = await Promise.all([
    supabase.from("staff_meetings").select(MEETING_COLUMNS).eq("team_id", team.id).order("created_at", { ascending: false }).limit(HISTORY),
    supabase
      .from("staff_messages")
      .select(MESSAGE_COLUMNS)
      .eq("team_id", team.id)
      .not("task_proposal", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const selectedId = opdracht && z.uuid().safeParse(opdracht).success ? opdracht : meetings?.[0]?.id;
  const selected = (meetings ?? []).find((m) => m.id === selectedId) ?? null;
  const { data: turns } = selected ? await supabase.from("staff_meeting_turns").select(TURN_COLUMNS).eq("meeting_id", selected.id) : { data: [] };

  const roles = STAFF_ROOM_ROLES.filter((id) => canConverse(staff, id));
  return (
    <StaffRoom
      key={selected?.id ?? "new"}
      teamId={team.id}
      roles={roles}
      roleNames={Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]))}
      plan={[...new Set(meetingTurns(staff).filter((t) => t.kind !== "overzicht").map((t) => t.role))]}
      history={(meetings ?? []).map((m) => ({ id: m.id, assignment: m.assignment, status: m.status, createdAt: m.created_at }))}
      initialMeeting={selected ? toMeetingView(selected, turns ?? []) : null}
      tasks={taskProposals((proposals ?? []).map(toChatMessage))}
      initialConsult={rol && isStaffRoomRole(rol) && roles.includes(rol) ? rol : null}
      canWrite={canEdit}
      testMode={getStaffProvider().id === "example"}
    />
  );
}
