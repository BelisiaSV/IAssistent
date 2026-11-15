import { canConverse } from "@iassistent/staff-engine";

import { getStaffProvider } from "@/lib/ai";
import { staff } from "@/lib/staff";
import { isStaffRoomRole, STAFF_ROOM_ROLES } from "@/lib/staff-room/roles";
import { MESSAGE_COLUMNS, toChatMessage } from "@/lib/staff-room/types";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { StaffRoom } from "./staff-room";

/** Messages loaded for the room (all roles of the team). */
const ROOM_MESSAGES = 600;

export default async function StaffRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ rol?: string }>;
}) {
  const [{ teamId }, { rol }] = await Promise.all([params, searchParams]);
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_messages")
    .select(MESSAGE_COLUMNS)
    .eq("team_id", team.id)
    .order("created_at", { ascending: false })
    .limit(ROOM_MESSAGES);

  const roles = STAFF_ROOM_ROLES.filter((id) => canConverse(staff, id));
  const roleNames = Object.fromEntries(staff.roles.map((r) => [r.id, r.meta.naam]));
  const selected = rol && isStaffRoomRole(rol) && roles.includes(rol) ? rol : roles[0]!;

  return (
    <StaffRoom
      teamId={team.id}
      roles={roles}
      roleNames={roleNames}
      initialRole={selected}
      initialMessages={(data ?? []).toReversed().map(toChatMessage)}
      canWrite={canEdit}
      testMode={getStaffProvider().id === "example"}
    />
  );
}
