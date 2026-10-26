import "server-only";

import type { Json, Tables } from "@iassistent/db";

import { type Animation, parseAnimation } from "@/lib/animation/schema";
import { themeForTeam } from "@/lib/animation/team-theme";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface WeekExercise {
  id: string;
  title: string;
  course: string[];
  variations: string[];
  animation: Animation | null;
  hasVideo: boolean;
}

/** Exercises from the coach's library used in week plannings, with the team's animation look. */
export interface WeekExercises {
  items: Map<string, WeekExercise>;
  display: ReturnType<typeof themeForTeam>;
  logoUrl: string | null;
}

/** Library ids used in Assistant Coach outputs (onderdelen[].oefening_id). */
export function exerciseIds(outputs: (Json | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const output of outputs) {
    const days = (output as { dagen?: { onderdelen?: { oefening_id?: string | null }[] }[] } | null)?.dagen ?? [];
    for (const day of days) for (const part of day.onderdelen ?? []) if (part.oefening_id) ids.add(part.oefening_id);
  }
  return [...ids];
}

/**
 * Loads the library exercises a week document refers to. Exercises belong to
 * the coach (RLS), so others who can read the team (T2, club owner) only see
 * the planning itself.
 */
export async function loadWeekExercises(
  supabase: Supabase,
  outputs: (Json | null | undefined)[],
  team: Pick<Tables<"teams">, "animation_settings">,
  logoUrl: string | null,
): Promise<WeekExercises> {
  const ids = exerciseIds(outputs);
  const { data } = ids.length
    ? await supabase.from("exercises").select("id, title, course, variations, animation, video_path").in("id", ids)
    : { data: [] };
  const items = new Map(
    (data ?? []).map((e) => [
      e.id,
      {
        id: e.id,
        title: e.title,
        course: e.course,
        variations: e.variations,
        animation: e.animation ? parseAnimation(e.animation) : null,
        hasVideo: e.video_path !== null,
      },
    ]),
  );
  return { items, display: themeForTeam(team.animation_settings), logoUrl };
}
