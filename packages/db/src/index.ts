export * from "./database.types";

/** Storage bucket for team logos. Object path: `<team_id>/<file>`. */
export const TEAM_LOGOS_BUCKET = "team-logos";
export const EXERCISE_VIDEOS_BUCKET = "exercise-videos";
/** Opponent logos and team photos for the match presentation: <team_id>/<file>. */
export const TEAM_MEDIA_BUCKET = "team-media";
/** Drawings and videos of the exercise bank (private, admin uploads). */
export const BANK_MEDIA_BUCKET = "bank-media";
/** Club documents and guidelines (module knowledge): <club_id>/<document_id>/<file>. */
export const CLUB_DOCUMENTS_BUCKET = "club-documents";
export const TEAM_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TEAM_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Feature flag keys. Add a key here when introducing a flag (skill: feature-flag). */
export const FEATURE_FLAGS = {
  /** Assistent Coach: weekplanning op basis van de weekinput. */
  assistantCoach: "staff.assistant_coach",
  /** Physical Coach: belastingsplan volgens de periodisering. */
  physicalCoach: "staff.physical_coach",
  /** Tactical Coach: wedstrijdplan, standaardsituaties en uitgetekende oefenstof. */
  tacticalCoach: "staff.tactical_coach",
} as const satisfies Record<string, string>;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Modules a club can have on top of the core (same codes as club_module_codes() in the database). */
export const CLUB_MODULES = ["dna", "exercises", "planning", "evaluations", "knowledge", "reports"] as const;
export type ClubModule = (typeof CLUB_MODULES)[number];

/** Club roles, from most to least rights (enum club_role). */
export const CLUB_ROLES = [
  "owner",
  "admin",
  "technical_director",
  "team_coordinator",
  "coach",
  "assistant_coach",
] as const;
export type ClubRole = (typeof CLUB_ROLES)[number];

/** Roles that use a licence seat (club_role_uses_license() in the database). */
export const CLUB_ROLES_WITH_LICENSE: readonly ClubRole[] = ["owner", "technical_director", "coach", "assistant_coach"];

/** Roles of a person on the staff of a club team (team_staff.role). */
export const TEAM_STAFF_ROLES = ["head_coach", "assistant_coach", "coordinator"] as const;
export type TeamStaffRole = (typeof TEAM_STAFF_ROLES)[number];

/**
 * Roles in the club file and the invitation form (club_invite_person() in the
 * database): club manager (= owner/admin), technical director, coordinator,
 * head coach and assistant coach of a team.
 */
export const CLUB_PERSON_ROLES = [
  "club_manager",
  "technical_director",
  "coordinator",
  "head_coach",
  "assistant_coach",
] as const;
export type ClubPersonRole = (typeof CLUB_PERSON_ROLES)[number];

/** Person roles that belong to a team. */
export const CLUB_PERSON_TEAM_ROLES: readonly ClubPersonRole[] = ["coordinator", "head_coach", "assistant_coach"];
