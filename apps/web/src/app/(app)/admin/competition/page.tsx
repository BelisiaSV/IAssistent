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
  const { data: teams } = await supabase.rpc("admin_competition_teams");

  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <CompetitionImport
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
