import "server-only";

import { BANK_MEDIA_BUCKET, EXERCISE_VIDEOS_BUCKET, type Json, type Tables } from "@iassistent/db";

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
  /** Signed URL of the coach's video (valid for an hour), if any. */
  videoUrl: string | null;
  signal: string | null;
}

/** Exercises from the coach's library used in week plannings, with the team's animation look. */
export interface WeekExercises {
  items: Map<string, WeekExercise>;
  /** Drawing or video of the bank exercises used, by bank number (signed URL, an hour). */
  bank: Map<string, { kind: "image" | "video"; url: string }>;
  display: ReturnType<typeof themeForTeam>;
  logoUrl: string | null;
}

/**
 * Library ids used in staff outputs: training parts of the Assistant Coach
 * (onderdelen[].oefening_id) and set pieces of the Tactical Coach
 * (standaardsituaties[].standaardsituatie_id).
 */
export function exerciseIds(outputs: (Json | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const output of outputs) {
    const o = output as {
      dagen?: { onderdelen?: { oefening_id?: string | null }[] }[];
      standaardsituaties?: { standaardsituatie_id?: string | null }[];
    } | null;
    for (const day of o?.dagen ?? []) for (const part of day.onderdelen ?? []) if (part.oefening_id) ids.add(part.oefening_id);
    for (const sp of o?.standaardsituaties ?? []) if (sp.standaardsituatie_id) ids.add(sp.standaardsituatie_id);
  }
  return [...ids];
}

/** Numbers of the exercise bank used in training parts (onderdelen[].bank_nummer). */
export function bankNumbers(outputs: (Json | null | undefined)[]): string[] {
  const numbers = new Set<string>();
  for (const output of outputs) {
    const o = output as { dagen?: { onderdelen?: { bank_nummer?: string | null }[] }[] } | null;
    for (const day of o?.dagen ?? []) for (const part of day.onderdelen ?? []) if (part.bank_nummer) numbers.add(part.bank_nummer);
  }
  return [...numbers];
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
    ? await supabase.from("exercises").select("id, title, course, variations, animation, video_path, signal").in("id", ids)
    : { data: [] };
  const paths = (data ?? []).flatMap((e) => (e.video_path ? [e.video_path] : []));
  const { data: signed } = paths.length
    ? await supabase.storage.from(EXERCISE_VIDEOS_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const videoUrl = (path: string | null) => (path ? (signed ?? []).find((s) => s.path === path)?.signedUrl ?? null : null);
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
        videoUrl: videoUrl(e.video_path),
        signal: e.signal,
      },
    ]),
  );
  // Bank exercises: their drawing or video (only approved ones are readable).
  const numbers = bankNumbers(outputs);
  const { data: bankRows } = numbers.length
    ? await supabase.from("bank_exercises").select("number, media_kind, media_path").in("number", numbers).not("media_path", "is", null)
    : { data: [] };
  const bankPaths = (bankRows ?? []).flatMap((b) => (b.media_path ? [b.media_path] : []));
  const { data: bankSigned } = bankPaths.length ? await supabase.storage.from(BANK_MEDIA_BUCKET).createSignedUrls(bankPaths, 3600) : { data: [] };
  const bank = new Map(
    (bankRows ?? []).flatMap((b) => {
      const url = (bankSigned ?? []).find((s) => s.path === b.media_path)?.signedUrl;
      return url ? [[b.number, { kind: b.media_kind === "video" ? ("video" as const) : ("image" as const), url }] as const] : [];
    }),
  );
  return { items, bank, display: themeForTeam(team.animation_settings), logoUrl };
}
