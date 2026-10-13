import "server-only";

import { TEAM_LOGOS_BUCKET } from "@iassistent/db";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** The team (if the user may read it), its logo URL and what the user may do. */
export const getTeamContext = cache(async (teamId: string) => {
  if (!z.uuid().safeParse(teamId).success) notFound();
  const user = await requireUser();
  const supabase = await createClient();

  const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) notFound();

  let logoUrl: string | null = null;
  if (team.logo_path) {
    const { data } = await supabase.storage
      .from(TEAM_LOGOS_BUCKET)
      .createSignedUrl(team.logo_path, 3600);
    logoUrl = data?.signedUrl ?? null;
  }

  const isHeadCoach = team.head_coach_id === user.id;
  return { team, logoUrl, isHeadCoach, canEdit: isHeadCoach && !team.archived_at };
});
