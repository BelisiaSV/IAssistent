import { TeamBanner } from "@/components/dashboard/team-banner";
import { TeamHeader } from "@/components/dashboard/team-header";
import { Alert } from "@/components/ui";
import { messages } from "@/lib/messages";
import { getTeamContext } from "@/lib/teams/queries";

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
      <TeamHeader teamId={team.id}>
        <TeamBanner team={team} logoUrl={logoUrl} />
      </TeamHeader>
      {team.archived_at && <Alert tone="error">{messages.common.readOnlyArchived}</Alert>}
      {!team.archived_at && !isHeadCoach && <Alert tone="success">{messages.common.readOnlyAssistant}</Alert>}
      {children}
    </div>
  );
}
