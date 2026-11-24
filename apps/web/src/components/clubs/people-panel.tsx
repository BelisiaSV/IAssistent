import { Modal } from "@/components/admin/modal";
import { Row, Rows } from "@/components/admin/rows";
import { messages } from "@/lib/messages";
import {
  checkClubFile,
  importClubFile,
  inviteClubPerson,
  revokeClubInvitation,
} from "@/lib/clubs/people-actions";
import {
  type ClubTeam,
  invitationRows,
  pendingInvitations,
} from "@/lib/clubs/people";
import type { createClient } from "@/lib/supabase/server";

import { ClubFileImport, InvitationCopy, InvitationRevoke, InviteForm } from "./people";

const m = messages.clubPeople;
const date = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric" });

/**
 * Mensen en teams, the same for the club manager and the platform admin: invite
 * by e-mail, the club file and the open invitations.
 */
export async function PeoplePanel({
  supabase,
  clubId,
  clubName,
  teams,
  active,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  clubId: string;
  clubName: string;
  teams: ClubTeam[];
  active: boolean;
}) {
  const invitations = await pendingInvitations(supabase, clubId);
  const activeTeams = teams.filter((t) => !t.archived);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-3">
      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <Modal label={m.invite.open} title={m.invite.title} primary wide>
            <InviteForm
              action={inviteClubPerson.bind(null, clubId)}
              teams={activeTeams.map((t) => ({ id: t.id, name: t.name }))}
            />
          </Modal>
          <Modal label={m.file.title} wide>
            <ClubFileImport
              templateHref={`/clubs/${clubId}/people/template`}
              check={checkClubFile.bind(null, clubId)}
              run={importClubFile.bind(null, clubId)}
            />
          </Modal>
        </div>
      )}
      <Rows title={m.invitations.title} empty={m.invitations.empty}>
        {invitations.map((i) => (
          <Row
            key={i.id}
            meta={
              <>
                <span>{i.email}</span>
                <span>
                  {invitationRows(i, teamName)
                    .map((r) => (r.team ? `${m.roles[r.role] ?? r.role} ${r.team}` : (m.roles[r.role] ?? r.role)))
                    .join(", ")}
                </span>
                <span>{m.invitations.since(date.format(new Date(i.created_at)))}</span>
              </>
            }
            actions={
              <>
                <InvitationCopy clubName={clubName} email={i.email} />
                <InvitationRevoke action={revokeClubInvitation.bind(null, clubId, i.id)} />
              </>
            }
          >
            {i.name ?? i.email}
          </Row>
        ))}
      </Rows>
    </div>
  );
}
