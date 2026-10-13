import { notFound } from "next/navigation";
import { z } from "zod";

import { messages } from "@/lib/messages";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { PlayerForm } from "../player-form";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ teamId: string; playerId: string }>;
}) {
  const { teamId, playerId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  if (!canEdit || !z.uuid().safeParse(playerId).success) notFound();

  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("team_id", team.id)
    .maybeSingle();
  if (!player) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">{messages.players.edit}</h2>
      <PlayerForm teamId={team.id} player={player} positions={positionCatalog} />
    </div>
  );
}
