import { redirect } from "next/navigation";

import { getTeamContext } from "@/lib/teams/queries";
import { mondayOf, todayInBelgium } from "@/lib/weeks/dates";

/** Physical Coach → Belasting: the planned and actual load of this week, on the week page. */
export default async function LoadPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team } = await getTeamContext(teamId);
  redirect(`/teams/${team.id}/weeks/${mondayOf(todayInBelgium())}?menu=load#belasting`);
}
