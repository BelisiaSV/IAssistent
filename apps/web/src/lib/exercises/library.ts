import type { Tables } from "@iassistent/db";
import type { LibraryExercise } from "@iassistent/staff-engine/content";

/** At most this many exercises go to the staff (most recently changed first). */
export const LIBRARY_LIMIT = 80;

/** Columns of an exercise the staff needs. */
export const LIBRARY_COLUMNS =
  "id, title, phase, labels, min_players, max_players, duration_min, sets, work_min, rest_min, intensity, rpe, organisation, course, coaching_points, variations, animation";

type LibraryRow = Pick<
  Tables<"exercises">,
  | "id"
  | "title"
  | "phase"
  | "labels"
  | "min_players"
  | "max_players"
  | "duration_min"
  | "sets"
  | "work_min"
  | "rest_min"
  | "intensity"
  | "rpe"
  | "organisation"
  | "course"
  | "coaching_points"
  | "variations"
  | "animation"
>;

/** An exercise of the coach as the staff gets it (Dutch keys, like all AI input). */
export function libraryExercise(row: LibraryRow): LibraryExercise {
  return {
    id: row.id,
    titel: row.title,
    fase: row.phase,
    labels: row.labels,
    spelers: { min: row.min_players, max: row.max_players },
    duur_min: row.duration_min,
    reeksen: row.sets,
    werk_min: row.work_min === null ? null : Number(row.work_min),
    rust_min: row.rest_min === null ? null : Number(row.rest_min),
    intensiteit: row.intensity,
    rpe: row.rpe,
    organisatie: row.organisation,
    verloop: row.course,
    coachingspunten: row.coaching_points,
    variaties: row.variations,
    animatie: row.animation !== null,
  };
}
