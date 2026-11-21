import { notFound } from "next/navigation";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { CompetitionImport } from "./competition-import";

const m = messages.competition.admin;

/** Admin only: link teams to the competition and import the weekly exports. */
export default async function AdminCompetitionPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const [{ data: teams }, { data: federation }] = await Promise.all([
    supabase.rpc("admin_competition_teams"),
    supabase.rpc("admin_federation_clubs"),
  ]);
  // Clubs on the platform: their divisions are kept, so a team that joins later has its data at once.
  const platformClubs = (federation ?? []).filter((f) => f.club_id);

  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <CompetitionImport
        clubNumbers={platformClubs.map((f) => f.number)}
        clubDivisions={platformClubs.flatMap((f) =>
          Array.isArray(f.teams)
            ? (f.teams as { divisions?: string[] }[]).flatMap(
                (t) => t.divisions ?? [],
              )
            : [],
        )}
        teams={(teams ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          clubName: t.club_name,
          archived: t.archived,
          federationTeam: t.federation_team ?? "",
          divisions: t.federation_divisions,
        }))}
      />
    </div>
  );
}
