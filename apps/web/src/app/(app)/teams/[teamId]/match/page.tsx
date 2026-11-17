import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { nextMatch } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, mondayOf, todayInBelgium } from "@/lib/weeks/dates";

/** Tactical Coach → Wedstrijdplan: the week of the next match, where the match plan and preparation are. */
export default async function MatchPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  const today = todayInBelgium();
  const supabase = await createClient();
  const { data: weeks } = await supabase
    .from("week_plans")
    .select("week_start, matches")
    .eq("team_id", team.id)
    .gte("week_start", addDays(mondayOf(today), -7))
    .order("week_start")
    .limit(8);
  const next = nextMatch(weeks ?? [], today);
  redirect(`/teams/${team.id}/weeks/${next?.weekStart ?? mondayOf(today)}?menu=match#match`);
}
