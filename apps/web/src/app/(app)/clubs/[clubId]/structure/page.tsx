import Link from "next/link";

import { Card, CardHeader, EmptyState } from "@/components/card";
import { ConfirmButton, StaffForm, TeamForm } from "@/components/clubs/forms";
import { PeopleTable } from "@/components/clubs/tables";
import {
  assignStaff,
  createClubTeam,
  decideLink,
  endStaff,
} from "@/lib/clubs/actions";
import { loadClubDashboard } from "@/lib/clubs/dashboard";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";
import { longDate } from "@/lib/weeks/dates";

const m = messages.club.structure;
const roles = messages.clubAdmin.teamRoles;
const categories = messages.ageCategories as Record<string, string>;

/** Teams per age category with their staff; the owner and admin change the staff, add teams and handle link requests. */
export default async function ClubStructurePage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  const { supabase } = ctx;
  const [data, people, links] = await Promise.all([
    loadClubDashboard(ctx),
    ctx.seesPeople
      ? supabase.rpc("club_people", { p_club_id: clubId })
      : Promise.resolve({ data: null }),
    ctx.canManage
      ? supabase.rpc("club_pending_links", { p_club_id: clubId })
      : Promise.resolve({ data: null }),
  ]);
  const active = data.teams.filter((t) => !t.archived);
  // Teams per age category, in the order of the categories.
  const groups = AGE_CATEGORIES.map((c) => ({
    category: c,
    teams: data.teams.filter((t) => t.ageCategory === c),
  })).filter((g) => g.teams.length);
  const staffable = (people.data ?? []).filter(
    (p) =>
      p.active &&
      (p.roles ?? []).some(
        (r) =>
          r === "coach" || r === "assistant_coach" || r === "team_coordinator",
      ),
  );

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">{m.intro}</p>

      {ctx.canManage && (links.data ?? []).length > 0 && (
        <Card>
          <CardHeader title={m.linksTitle} hint={m.linksIntro} />
          <ul className="divide-y divide-slate-100 px-5 pb-4 text-sm">
            {(links.data ?? []).map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span>
                  <span className="font-medium">{l.team_name}</span>{" "}
                  <span className="text-slate-500">({l.team_club_name})</span> ·{" "}
                  {m.requestedBy(l.requester)} ·{" "}
                  {longDate(l.requested_at.slice(0, 10))}
                </span>
                <span className="flex gap-4">
                  <form action={decideLink}>
                    <input type="hidden" name="clubId" value={clubId} />
                    <input type="hidden" name="linkId" value={l.id} />
                    <input type="hidden" name="approve" value="1" />
                    <ConfirmButton
                      label={m.approve}
                      confirmText={m.approveConfirm}
                      tone="primary"
                    />
                  </form>
                  <form action={decideLink}>
                    <input type="hidden" name="clubId" value={clubId} />
                    <input type="hidden" name="linkId" value={l.id} />
                    <input type="hidden" name="approve" value="0" />
                    <button
                      type="submit"
                      className="text-sm font-medium text-red-700 hover:underline"
                    >
                      {m.reject}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {groups.length ? (
        groups.map((g) => (
          <Card key={g.category}>
            <CardHeader title={categories[g.category] ?? g.category} />
            <ul className="divide-y divide-slate-100 px-5 pb-4">
              {g.teams.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <Link
                    href={`/teams/${t.id}`}
                    className={`font-medium hover:underline ${t.archived ? "text-slate-400" : "text-brand"}`}
                  >
                    {t.name}
                    {t.archived && (
                      <span className="ml-2 text-xs">({m.archived})</span>
                    )}
                  </Link>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {t.staff.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1"
                      >
                        <span>
                          {s.name}{" "}
                          <span className="text-slate-500">
                            · {roles[s.role] ?? s.role}
                          </span>
                        </span>
                        {ctx.canManage && !t.archived && (
                          <form action={endStaff}>
                            <input type="hidden" name="clubId" value={clubId} />
                            <input type="hidden" name="staffId" value={s.id} />
                            <ConfirmButton
                              label="×"
                              confirmText={m.removeConfirm}
                            />
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Card>
        ))
      ) : (
        <EmptyState text={messages.club.dashboard.noTeams} />
      )}

      {ctx.canManage && (
        <div className="grid gap-5 xl:grid-cols-2">
          {active.length > 0 && staffable.length > 0 && (
            <Card>
              <CardHeader title={m.staffTitle} />
              <div className="px-5 pb-4">
                <StaffForm
                  action={assignStaff.bind(null, clubId)}
                  teams={active.map((t) => ({ id: t.id, name: t.name }))}
                  people={staffable.map((p) => ({
                    id: p.coach_id,
                    name: p.name ?? p.email,
                  }))}
                />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title={m.newTeam} />
            <div className="px-5 pb-4">
              <TeamForm action={createClubTeam.bind(null, clubId)} />
            </div>
          </Card>
        </div>
      )}

      {ctx.seesPeople && (
        <Card>
          <CardHeader title={m.people} />
          <div className="px-5 pb-4">
            <PeopleTable clubId={clubId} people={people.data ?? []} />
          </div>
        </Card>
      )}
    </div>
  );
}
