import { notFound } from "next/navigation";

import { CodeForm } from "@/components/clubs/forms";
import { PeoplePanel } from "@/components/clubs/people-panel";
import {
  CodesTable,
  HistoryList,
  PeopleTable,
} from "@/components/clubs/tables";
import {
  createClubCode,
  endClubRole,
  reissueClubCode,
  revokeClubCode,
  revokeClubLicense,
} from "@/lib/clubs/actions";
import { getClubContext } from "@/lib/clubs/load";
import { clubTeams } from "@/lib/clubs/people";
import { messages } from "@/lib/messages";

const m = messages.club.licenses;
const p = messages.clubPeople;

/** Club manager: people and teams — invitations by e-mail, the club file, licences, codes as a fallback and history. */
export default async function ClubPeoplePage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  if (!ctx.canManage) notFound();
  const { supabase } = ctx;
  const [
    { data: used },
    { data: people },
    { data: codes },
    { data: members },
    teams,
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
    clubTeams(supabase, clubId, false),
    supabase
      .from("club_audit_log")
      .select("id, action, coach_id, team_id, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const personName = new Map(
    (people ?? []).map((x) => [x.coach_id, x.name ?? x.email]),
  );

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">{p.intro}</p>
      <p className="text-sm font-medium">
        {p.usage(used ?? 0, ctx.subscription?.license_seats ?? 0)}
      </p>

      <PeoplePanel
        supabase={supabase}
        clubId={clubId}
        clubName={ctx.club.name}
        teams={teams}
        active={ctx.active}
      />

      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-slate-700">
          {messages.clubAdmin.sections.members}
        </h2>
        <div className="rounded-xl bg-white px-3 py-1 ring-1 ring-slate-200">
          <PeopleTable
            clubId={clubId}
            people={people ?? []}
            revokeLicense={revokeClubLicense}
            endRole={endClubRole}
            roleMembers={members ?? []}
          />
        </div>
      </section>

      <details className="rounded-xl bg-white ring-1 ring-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
          {p.fallback.title}
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-3 py-3">
          <p className="text-sm text-slate-600">{p.fallback.intro}</p>
          {ctx.active && (
            <CodeForm
              action={createClubCode.bind(null, clubId)}
              clubName={ctx.club.name}
              teams={teams
                .filter((t) => !t.archived)
                .map((t) => ({ id: t.id, name: t.name }))}
            />
          )}
          <CodesTable
            clubId={clubId}
            codes={codes ?? []}
            teamName={teamName}
            revoke={revokeClubCode}
            reissue={reissueClubCode.bind(null, clubId)}
            clubName={ctx.club.name}
          />
        </div>
      </details>

      <details className="rounded-xl bg-white ring-1 ring-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
          {m.history}
        </summary>
        <div className="border-t border-slate-100 px-3 py-1">
          <HistoryList
            entries={history ?? []}
            personName={personName}
            teamName={teamName}
          />
        </div>
      </details>
    </div>
  );
}
