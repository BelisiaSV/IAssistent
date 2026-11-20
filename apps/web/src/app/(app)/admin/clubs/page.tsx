import Link from "next/link";
import { notFound } from "next/navigation";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { longDate } from "@/lib/weeks/dates";

import { NewClubForm } from "./new-club-form";

const m = messages.clubAdmin;

/** Admin only: the clubs of the platform and a new club from the federation export. */
export default async function AdminClubsPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const [{ data: clubs }, { data: federation }] = await Promise.all([
    supabase.rpc("admin_clubs"),
    supabase.rpc("admin_federation_clubs"),
  ]);
  const options = (federation ?? []).map((f) => ({
    number: f.number,
    name: f.name,
    teams: Array.isArray(f.teams) ? f.teams.length : 0,
    made: f.club_id !== null,
  }));

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {clubs?.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{m.columns.club}</th>
                <th className="px-4 py-3 font-medium">{m.columns.number}</th>
                <th className="px-4 py-3 font-medium">{m.columns.plan}</th>
                <th className="px-4 py-3 font-medium">{m.columns.licenses}</th>
                <th className="px-4 py-3 font-medium">{m.columns.teams}</th>
                <th className="px-4 py-3 font-medium">{m.columns.members}</th>
                <th className="px-4 py-3 font-medium">{m.columns.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clubs.map((club) => (
                <tr key={club.id}>
                  <td className="px-4 py-2.5 font-medium">
                    <Link
                      href={`/admin/clubs/${club.id}`}
                      className="text-brand hover:underline"
                    >
                      {club.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {club.federation_number ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">{club.plan_name ?? m.noPlan}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {club.seats_used} / {club.license_seats}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {club.active_teams} / {club.max_teams ?? m.unlimited}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{club.members}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${club.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {club.active ? m.active : m.inactive}
                    </span>
                    {club.active && club.ends_on && (
                      <span className="ml-2 text-xs text-slate-500">
                        {m.until(longDate(club.ends_on))}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-600">{m.empty}</p>
        )}
      </div>

      <section className="max-w-3xl space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{m.newClub.title}</h2>
          <p className="text-sm text-slate-600">{m.newClub.intro}</p>
        </div>
        <NewClubForm options={options} />
      </section>
    </div>
  );
}
