import "server-only";

import type { ClubRole } from "@iassistent/db";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface MyClub {
  id: string;
  name: string;
  roles: ClubRole[];
}

/** The clubs the signed-in user is an active member of, with their roles. */
export const loadMyClubs = cache(async (): Promise<MyClub[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, role")
    .eq("coach_id", user.id)
    .is("ended_at", null);
  if (!memberships?.length) return [];
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .in(
      "id",
      memberships.map((m) => m.club_id),
    )
    .order("name");
  return (clubs ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    roles: memberships.filter((m) => m.club_id === c.id).map((m) => m.role),
  }));
});

/** Roles that manage the club (people, codes, licences, teams). */
export const MANAGER_ROLES: readonly ClubRole[] = ["owner", "admin"];
/** Roles that see the whole club. */
export const OVERVIEW_ROLES: readonly ClubRole[] = [
  "owner",
  "admin",
  "technical_director",
];

/** One club of the user (404 when not a member), with what the pages need. */
export const getClubContext = cache(async (clubId: string) => {
  if (!z.uuid().safeParse(clubId).success) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const [
    { data: club },
    { data: roles },
    { data: subscription },
    { data: active },
  ] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(),
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("coach_id", user.id)
      .is("ended_at", null),
    supabase
      .from("club_subscriptions")
      .select("*")
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase.rpc("club_is_active", { p_club_id: clubId }),
  ]);
  if (!club || !roles?.length) notFound();
  const myRoles = roles.map((r) => r.role);
  return {
    user,
    supabase,
    club,
    roles: myRoles,
    subscription,
    active: active === true,
    canManage: myRoles.some((r) => MANAGER_ROLES.includes(r)),
    seesAll: myRoles.some((r) => OVERVIEW_ROLES.includes(r)),
    seesPeople: myRoles.some((r) => r !== "coach" && r !== "assistant_coach"),
  };
});
