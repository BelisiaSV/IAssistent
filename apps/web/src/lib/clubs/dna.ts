import "server-only";

import {
  type ClubDnaContext,
  clubDnaContext,
  readClubDna,
} from "@iassistent/staff-engine/content";

import { clubDnaQuestionnaire } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { ageCategory } from "@/lib/teams/age-categories";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The published DNA of the team's club, as the staff of that team gets it
 * (principles by level and the goals of the team's age category). Null for a
 * personal team, a club without the DNA module or without a published version.
 */
export async function clubDnaForTeam(
  supabase: Supabase,
  team: { club_id: string | null; age_category: string },
): Promise<ClubDnaContext | null> {
  if (!team.club_id) return null;
  const [{ data: active }, { data: dna }, { data: club }] = await Promise.all([
    supabase.rpc("club_has_module", {
      p_club_id: team.club_id,
      p_module: "dna",
    }),
    supabase
      .from("club_dna")
      .select("version, content")
      .eq("club_id", team.club_id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("clubs").select("name").eq("id", team.club_id).maybeSingle(),
  ]);
  if (active !== true || !dna) return null;
  return clubDnaContext(clubDnaQuestionnaire, readClubDna(dna.content), {
    club: club?.name ?? "",
    version: dna.version,
    category: ageCategory(team.age_category),
  });
}
