export * from "./database.types";

/** Storage bucket for team logos. Object path: `<team_id>/<file>`. */
export const TEAM_LOGOS_BUCKET = "team-logos";
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
