import { notFound } from "next/navigation";

import { Card, CardHeader } from "@/components/card";
import { CodeForm } from "@/components/clubs/forms";
import {
  CodesTable,
  HistoryList,
  PeopleTable,
} from "@/components/clubs/tables";
import {
  createClubCode,
  endClubRole,
  revokeClubCode,
  revokeClubLicense,
} from "@/lib/clubs/actions";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";

const m = messages.club.licenses;

/** Owner and admin: codes, licences and the history of the club. */
export default async function ClubLicensesPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  if (!ctx.canManage) notFound();
  const { supabase } = ctx;
  const owner = ctx.roles.includes("owner");
  const [
    { data: used },
    { data: people },
    { data: codes },
    { data: members },
    { data: teams },
    { data: history },
  ] = await Promise.all([
    supabase.rpc("club_seats_used", { p_club_id: clubId }),
    supabase.rpc("club_people", { p_club_id: clubId }),
    supabase
      .from("club_activation_codes")
      .select(
        "id, code_hint, role, team_id, team_role, note, expires_at, status, created_at",
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("club_members")
      .select("id, coach_id, role")
      .eq("club_id", clubId)
      .is("ended_at", null),
    supabase
      .from("teams")
      .select("id, name, archived_at")
      .eq("club_id", clubId)
      .order("name"),
    supabase
      .from("club_audit_log")
      .select("id, action, coach_id, team_id, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const personName = new Map(
    (people ?? []).map((p) => [p.coach_id, p.name ?? p.email]),
  );

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">{m.intro}</p>
      <p className="text-sm font-medium">
        {m.usage(used ?? 0, ctx.subscription?.license_seats ?? 0)}
      </p>

      <Card>
        <CardHeader title={messages.clubAdmin.sections.codes} />
        <div className="space-y-5 px-5 pb-4">
          {ctx.active && (
            <CodeForm
              action={createClubCode.bind(null, clubId)}
              teams={(teams ?? [])
                .filter((t) => !t.archived_at)
                .map((t) => ({ id: t.id, name: t.name }))}
              roles={
                owner
                  ? undefined
                  : [
                      "technical_director",
                      "team_coordinator",
                      "coach",
                      "assistant_coach",
                    ]
              }
            />
          )}
          <CodesTable
            clubId={clubId}
            codes={codes ?? []}
            teamName={teamName}
            revoke={revokeClubCode}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={messages.clubAdmin.sections.members} />
        <div className="px-5 pb-4">
          <PeopleTable
            clubId={clubId}
            people={people ?? []}
            revokeLicense={revokeClubLicense}
            endRole={endClubRole}
            roleMembers={members ?? []}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={m.history} />
        <div className="px-5 pb-4">
          <HistoryList
            entries={history ?? []}
            personName={personName}
            teamName={teamName}
          />
        </div>
      </Card>
    </div>
  );
}
