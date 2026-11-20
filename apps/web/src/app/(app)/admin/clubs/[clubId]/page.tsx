import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { createCode, createTeam, revokeCode, revokeLicense } from "../actions";
import { CodeForm, TeamForm } from "@/components/clubs/forms";
import {
  CodesTable,
  HistoryList,
  PeopleTable,
} from "@/components/clubs/tables";

import { DetailsForm, SubscriptionForm } from "./club-forms";
import { ClubImport } from "./club-import";

const m = messages.clubAdmin;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

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
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const personName = new Map(
    (members ?? []).map((p) => [p.coach_id, p.name ?? p.email]),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/admin/clubs"
          className="text-sm text-brand hover:underline"
        >
          {m.back}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{club.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stats?.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
          >
            {stats?.active ? m.active : m.inactive}
          </span>
        </div>
        {club.federation_number && (
          <p className="text-sm text-slate-600">
            {m.numberLabel(club.federation_number)}
          </p>
        )}
      </div>

      <Section title={m.sections.subscription}>
        {stats && (
          <p className="text-sm font-medium">
            {m.subscription.usage(stats.seats_used, stats.license_seats)}
          </p>
        )}
        <SubscriptionForm
          clubId={clubId}
          plans={(plans ?? []).map((p) => ({ ...p, modules: p.modules ?? [] }))}
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
      </Section>

      <Section title={m.sections.excel}>
        <ClubImport clubId={clubId} clubName={club.name} />
      </Section>

      <Section title={m.sections.codes}>
        <CodeForm
          action={createCode.bind(null, clubId)}
          teams={activeTeams.map((t) => ({ id: t.id, name: t.name }))}
        />
        <CodesTable
          clubId={clubId}
          codes={codes ?? []}
          teamName={teamName}
          revoke={revokeCode}
        />
      </Section>

      <Section title={m.sections.members}>
        <PeopleTable
          clubId={clubId}
          people={members ?? []}
          revokeLicense={revokeLicense}
        />
      </Section>

      <Section title={m.sections.teams}>
        {teams?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">
                    {m.teams.columns.name}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {m.teams.columns.category}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {m.teams.columns.season}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {m.teams.columns.competition}
                  </th>
                  <th className="py-2 font-medium">{m.teams.columns.staff}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teams.map((t) => {
                  const staff = Array.isArray(t.staff)
                    ? (t.staff as { id: string; role: string; name: string }[])
                    : [];
                  return (
                    <tr
                      key={t.id}
                      className={t.archived ? "text-slate-400" : ""}
                    >
                      <td className="py-2 pr-3 font-medium">
                        {t.name}
                        {t.archived && (
                          <span className="ml-2 text-xs">
                            ({m.teams.archived})
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {(messages.ageCategories as Record<string, string>)[
                          t.age_category
                        ] ?? t.age_category}
                      </td>
                      <td className="py-2 pr-3">{t.season ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {t.federation_team ?? "—"}
                        {t.federation_divisions.length
                          ? ` (${t.federation_divisions.join(", ")})`
                          : ""}
                      </td>
                      <td className="py-2">
                        {staff.length
                          ? staff
                              .map(
                                (s) =>
                                  `${s.name} (${m.teamRoles[s.role] ?? s.role})`,
                              )
                              .join(", ")
                          : m.teams.noStaff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">{m.teams.empty}</p>
        )}
        <TeamForm action={createTeam.bind(null, clubId)} />
      </Section>

      <Section title={m.sections.details}>
        <DetailsForm clubId={clubId} club={club} />
      </Section>

      <Section title={m.sections.history}>
        <HistoryList
          entries={history ?? []}
          personName={personName}
          teamName={teamName}
        />
      </Section>
    </div>
  );
}
