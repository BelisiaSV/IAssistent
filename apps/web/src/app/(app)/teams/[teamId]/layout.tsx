import { TeamBadge } from "@/components/team-card";
import { Alert } from "@/components/ui";
import { messages } from "@/lib/messages";
import { getTeamContext } from "@/lib/teams/queries";

import { TeamTabs } from "./team-tabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { team, logoUrl, isHeadCoach } = await getTeamContext(teamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <TeamBadge
          clubName={team.club_name}
          logoUrl={logoUrl}
          primaryColor={team.primary_color}
          secondaryColor={team.secondary_color}
        />
        <div>
          <h1 className="text-2xl font-semibold">{team.club_name}</h1>
          <p className="text-sm text-slate-600">
            {team.name}
            {team.season ? ` · ${team.season}` : ""}
          </p>
        </div>
      </div>
      {team.archived_at && <Alert tone="error">{messages.common.readOnlyArchived}</Alert>}
      {!team.archived_at && !isHeadCoach && <Alert tone="success">{messages.common.readOnlyAssistant}</Alert>}
      <TeamTabs teamId={team.id} />
      {children}
    </div>
  );
}
