/**
 * The roles in the Staff Room, in the order the head coach sees them: the
 * coordinator first, then the staff. Ids as in /staff.
 */
export const STAFF_ROOM_ROLES = [
  "coordinator",
  "assistant-coach",
  "physical-coach",
  "tactical-coach",
  "video-analyst",
  "player-development",
  "team-manager",
] as const;

export type StaffRoomRole = (typeof STAFF_ROOM_ROLES)[number];

export function isStaffRoomRole(value: string): value is StaffRoomRole {
  return (STAFF_ROOM_ROLES as readonly string[]).includes(value);
}

/** Longest message the head coach can send. */
export const MESSAGE_MAX = 2000;
/** Earlier messages of the conversation that go along with a question. */
export const HISTORY_MESSAGES = 20;
