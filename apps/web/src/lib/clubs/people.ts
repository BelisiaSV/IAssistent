import "server-only";

import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ClubTeam {
  id: string;
  name: string;
  category: string;
  federationTeam: string | null;
  archived: boolean;
}

export interface ClubInvitation {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  teams: { team_id: string; role: string }[];
  created_at: string;
}

/**
 * Who may manage the people and teams of a club: its club managers and the
 * platform admin. Null for anyone else (the database checks again).
 */
export async function clubAccess(clubId: string) {
  if (!z.uuid().safeParse(clubId).success) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const [admin, { data: roles }] = await Promise.all([
    isPlatformAdmin(supabase),
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("coach_id", user.id)
      .is("ended_at", null)
      .in("role", ["owner", "admin"]),
  ]);
  if (!admin && !roles?.length) return null;
  return { supabase, admin, user };
}

/** The club's teams: via the admin function for the platform admin, else the club's own teams. */
export async function clubTeams(
  supabase: Supabase,
  clubId: string,
  admin: boolean,
): Promise<ClubTeam[]> {
  if (admin) {
    const { data } = await supabase.rpc("admin_club_teams", { p_club_id: clubId });
    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.age_category,
      federationTeam: t.federation_team,
      archived: t.archived,
    }));
  }
  const { data } = await supabase
    .from("teams")
    .select("id, name, age_category, federation_team, archived_at")
    .eq("club_id", clubId)
    .order("name");
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.age_category,
    federationTeam: t.federation_team,
    archived: !!t.archived_at,
  }));
}

/** The club's teams in the competition export. */
export async function federationTeams(supabase: Supabase, clubId: string) {
  const { data } = await supabase.rpc("club_federation_teams", { p_club_id: clubId });
  return (data ?? []).map((f) => f.name);
}

export async function pendingInvitations(
  supabase: Supabase,
  clubId: string,
): Promise<ClubInvitation[]> {
  const { data } = await supabase
    .from("club_invitations")
    .select("id, email, name, roles, teams, created_at")
    .eq("club_id", clubId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map((i) => ({
    ...i,
    teams: Array.isArray(i.teams) ? (i.teams as ClubInvitation["teams"]) : [],
  }));
}

/**
 * The roles of an invitation as roles of the club file (one per team place,
 * plus the roles without a team).
 */
export function invitationRows(
  invitation: ClubInvitation,
  teamName: Map<string, string>,
): { role: string; team: string }[] {
  const rows = invitation.teams.map((t) => ({
    role: t.role,
    team: teamName.get(t.team_id) ?? "",
  }));
  const withTeam = new Set(invitation.teams.map((t) => t.role));
  for (const r of invitation.roles) {
    const role =
      r === "owner" || r === "admin"
        ? "club_manager"
        : r === "team_coordinator"
          ? "coordinator"
          : r === "coach"
            ? "head_coach"
            : r;
    if (!withTeam.has(role)) rows.push({ role, team: "" });
  }
  return rows;
}

/** The people of the club with their roles and licence. */
export async function clubMembers(supabase: Supabase, clubId: string, admin: boolean) {
  const { data } = admin
    ? await supabase.rpc("admin_club_members", { p_club_id: clubId })
    : await supabase.rpc("club_people", { p_club_id: clubId });
  return data ?? [];
}
