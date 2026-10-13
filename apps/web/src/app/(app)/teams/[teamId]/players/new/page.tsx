import { notFound } from "next/navigation";

import { messages } from "@/lib/messages";
import { positionCatalog } from "@/lib/staff";
import { getTeamContext } from "@/lib/teams/queries";

import { PlayerForm } from "../player-form";

export default async function NewPlayerPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  if (!canEdit) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">{messages.players.add}</h2>
      <PlayerForm teamId={team.id} positions={positionCatalog} />
    </div>
  );
}
