import "server-only";

import {
  type ClubDnaContext,
  clubDnaContext,
  readClubDna,
} from "@iassistent/staff-engine/content";

import { clubDnaQuestionnaire } from "@/lib/staff";
import type { createClient } from "@/lib/supabase/server";
import { ageCategory } from "@/lib/teams/age-categories";
import { todayInBelgium } from "@/lib/weeks/dates";

import { periodFor } from "./periods";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The published DNA of the team's club, as the staff of that team gets it
 * (principles by level and the goals of the team's age category), with the
 * club's period of `date` for that category (club planning). Null for a
 * personal team, or when the club has neither a published DNA (with the DNA
 * module) nor a period (with the planning module).
 */
export async function clubDnaForTeam(
  supabase: Supabase,
  team: { club_id: string | null; age_category: string },
  date: string = todayInBelgium(),
): Promise<ClubDnaContext | null> {
  if (!team.club_id) return null;
  const category = ageCategory(team.age_category);
  const [{ data: dnaModule }, { data: planningModule }, { data: dna }, { data: club }, { data: periods }] = await Promise.all([
    supabase.rpc("club_has_module", { p_club_id: team.club_id, p_module: "dna" }),
    supabase.rpc("club_has_module", { p_club_id: team.club_id, p_module: "planning" }),
    supabase
      .from("club_dna")
      .select("version, content")
      .eq("club_id", team.club_id)
      .eq("status", "published")
      .maybeSingle(),
    supabase.from("clubs").select("name").eq("id", team.club_id).maybeSingle(),
    supabase
      .from("club_periods")
      .select("title, starts_on, ends_on, age_categories, goals, focus")
      .eq("club_id", team.club_id)
      .lte("starts_on", date)
      .gte("ends_on", date)
      .order("starts_on", { ascending: false }),
  ]);
  const period = planningModule === true ? periodFor(periods ?? [], category) : null;
  const name = club?.name ?? "";
  if (dnaModule === true && dna) {
    return {
      ...clubDnaContext(clubDnaQuestionnaire, readClubDna(dna.content), { club: name, version: dna.version, category }),
      periode: period,
    };
  }
  if (!period) return null;
  // No published DNA: only the period of the club planning.
  return { club: name, versie: 0, samenvatting: null, verplicht: [], aanbevolen: [], leeftijdscategorie: category, doelen: [], periode: period };
}
