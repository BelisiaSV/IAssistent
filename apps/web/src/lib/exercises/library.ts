import type { Tables } from "@iassistent/db";
import type { LibraryExercise } from "@iassistent/staff-engine/content";
import { z } from "zod";

/** At most this many exercises go to the staff (most recently changed first). */
export const LIBRARY_LIMIT = 80;

/** Columns of an exercise the staff needs. */
export const LIBRARY_COLUMNS =
  "id, kind, title, phase, labels, min_players, max_players, duration_min, sets, work_min, rest_min, intensity, rpe, organisation, course, coaching_points, variations, animation, set_piece_type, signal, roles";

type LibraryRow = Pick<
  Tables<"exercises">,
  | "id"
  | "kind"
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
  | "set_piece_type"
  | "signal"
  | "roles"
>;

const roleSchema = z.array(z.object({ rol: z.string(), vereiste: z.string().nullable() }));

/** Roles of a set piece as stored (`[{ rol, vereiste }]`); invalid data gives none. */
export function setPieceRoles(raw: unknown): { rol: string; vereiste: string | null }[] {
  const parsed = roleSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** An exercise of the coach as the staff gets it (Dutch keys, like all AI input). */
export function libraryExercise(row: LibraryRow): LibraryExercise {
  return {
    id: row.id,
    soort: row.kind === "set_piece" ? "standaardsituatie" : "oefening",
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
    standaardsituatie:
      row.kind === "set_piece" && row.set_piece_type
        ? { type: row.set_piece_type, teken: row.signal, rollen: setPieceRoles(row.roles) }
        : null,
  };
}
