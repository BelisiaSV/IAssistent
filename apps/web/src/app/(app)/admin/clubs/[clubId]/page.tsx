import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Modal } from "@/components/admin/modal";
import { AdminHeader, Badge, Row, Rows } from "@/components/admin/rows";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import {
  createCode,
  createTeam,
  reissueAdminCode,
  revokeCode,
  revokeLicense,
} from "../actions";
import { CodeForm, TeamForm } from "@/components/clubs/forms";
import {
  CodesTable,
  HistoryList,
  PeopleTable,
} from "@/components/clubs/tables";

import { PeoplePanel } from "@/components/clubs/people-panel";
import type { ClubTeam } from "@/lib/clubs/people";

import { DetailsForm, SubscriptionForm } from "./club-forms";

const m = messages.clubAdmin;

/** Admin only: one club — details, subscription, Excel, codes, members, teams and history. */
export default async function AdminClubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  if (!z.uuid().safeParse(clubId).success) notFound();
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();

  const [
    { data: club },
    { data: subscription },
    { data: plans },
    { data: overview },
    { data: teams },
    { data: members },
    { data: codes },
    { data: history },
  ] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(),
    supabase
      .from("club_subscriptions")
      .select("*")
      .eq("club_id", clubId)
      .maybeSingle(),
    supabase
      .from("plans")
      .select("id, name, modules, max_coaches, max_teams")
      .eq("audience", "club")
      .order("sort_order"),
    supabase.rpc("admin_clubs"),
    supabase.rpc("admin_club_teams", { p_club_id: clubId }),
    supabase.rpc("admin_club_members", { p_club_id: clubId }),
    supabase
      .from("club_activation_codes")
      .select(
        "id, code_hint, role, team_id, team_role, note, expires_at, status, created_at",
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("club_audit_log")
      .select("id, action, actor_id, coach_id, team_id, details, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  if (!club) notFound();
  const stats = (overview ?? []).find((c) => c.id === clubId);
  const activeTeams = (teams ?? []).filter((t) => !t.archived);
  const peopleTeams: ClubTeam[] = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.age_category,
    federationTeam: t.federation_team,
    archived: t.archived,
  }));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const personName = new Map(
    (members ?? []).map((p) => [p.coach_id, p.name ?? p.email]),
  );

  return (
    <div className="space-y-5">
      <Link href="/admin/clubs" className="text-xs text-brand hover:underline">
        {m.back}
      </Link>
      {/* One line: the club and everything the admin can do. */}
      <AdminHeader
        title={club.name}
        intro={[
          club.federation_number ? m.numberLabel(club.federation_number) : null,
          stats
            ? m.subscription.usage(stats.seats_used, stats.license_seats)
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <Badge tone={stats?.active ? "green" : "slate"}>
              {stats?.active ? m.active : m.inactive}
            </Badge>
            <Modal label={m.sections.subscription} wide>
              <SubscriptionForm
                clubId={clubId}
                plans={(plans ?? []).map((p) => ({
                  ...p,
                  modules: p.modules ?? [],
                }))}
                subscription={
                  subscription
                    ? {
                        plan_id: subscription.plan_id,
                        license_seats: subscription.license_seats,
                        max_teams: subscription.max_teams,
                        modules: subscription.modules,
                        starts_on: subscription.starts_on,
                        ends_on: subscription.ends_on,
                      }
                    : null
                }
              />
            </Modal>
            <Modal label={m.teams.create}>
              <TeamForm action={createTeam.bind(null, clubId)} />
            </Modal>
            <Modal label={m.sections.details} wide>
              <DetailsForm clubId={clubId} club={club} />
            </Modal>
          </>
        }
      />

      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-slate-700">
          {m.sections.people}
        </h2>
        <PeoplePanel
          supabase={supabase}
          clubId={clubId}
          clubName={club.name}
          teams={peopleTeams}
          active={!!stats?.active}
        />
      </section>

      <details className="rounded-xl bg-white ring-1 ring-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
          {messages.clubPeople.fallback.title}
        </summary>
        <div className="space-y-4 border-t border-slate-100 px-3 py-3">
          <p className="text-sm text-slate-600">{messages.clubPeople.fallback.intro}</p>
          {stats?.active && (
            <CodeForm
              action={createCode.bind(null, clubId)}
              clubName={club.name}
              teams={activeTeams.map((t) => ({ id: t.id, name: t.name }))}
            />
          )}
          <CodesTable
            clubId={clubId}
            codes={codes ?? []}
            teamName={teamName}
            revoke={revokeCode}
            reissue={reissueAdminCode.bind(null, clubId)}
            clubName={club.name}
          />
        </div>
      </details>

      <Rows title={m.sections.teams} empty={m.teams.empty}>
        {(teams ?? []).map((t) => {
          const staff = Array.isArray(t.staff)
            ? (t.staff as { id: string; role: string; name: string }[])
            : [];
          return (
            <Row
              key={t.id}
              muted={t.archived}
              meta={
                <>
                  <span>
                    {(messages.ageCategories as Record<string, string>)[
                      t.age_category
                    ] ?? t.age_category}
                  </span>
                  {t.season && <span>{t.season}</span>}
                  <span title={m.teams.columns.competition}>
                    {t.federation_team ?? "—"}
                    {t.federation_divisions.length
                      ? ` (${t.federation_divisions.join(", ")})`
                      : ""}
                  </span>
                  <span>
                    {staff.length
                      ? staff
                          .map(
                            (s) =>
                              `${s.name} (${m.teamRoles[s.role] ?? s.role})`,
                          )
                          .join(", ")
                      : m.teams.noStaff}
                  </span>
                  {t.archived && <Badge>{m.teams.archived}</Badge>}
                </>
              }
            >
              {t.name}
            </Row>
          );
        })}
      </Rows>

      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-slate-700">
          {m.sections.members}
        </h2>
        <div className="rounded-xl bg-white px-3 py-1 ring-1 ring-slate-200">
          <PeopleTable
            clubId={clubId}
            people={members ?? []}
            revokeLicense={revokeLicense}
          />
        </div>
      </section>

      <details className="rounded-xl bg-white ring-1 ring-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
          {m.sections.history}
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
