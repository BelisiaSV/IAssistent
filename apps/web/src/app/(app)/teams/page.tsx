import { type Tables, TEAM_LOGOS_BUCKET } from "@iassistent/db";
import Link from "next/link";

import { TeamCard } from "@/components/team-card";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { archiveTeam, restoreTeam } from "./actions";

const m = messages.teams;

const ERRORS: Record<string, string> = {
  archive: m.errors.archiveFailed,
  restore: m.errors.restoreFailed,
  license: m.errors.noLicenseSeats,
};

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { created, error } = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });

  const logoPaths = (teams ?? []).flatMap((t) => (t.logo_path ? [t.logo_path] : []));
  const logoUrls = new Map<string, string>();
  if (logoPaths.length > 0) {
    const { data } = await supabase.storage.from(TEAM_LOGOS_BUCKET).createSignedUrls(logoPaths, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) logoUrls.set(item.path, item.signedUrl);
    }
  }

  const active = (teams ?? []).filter((t) => !t.archived_at);
  const archived = (teams ?? []).filter((t) => t.archived_at);

  const card = (team: Tables<"teams">) => {
    const isHeadCoach = team.head_coach_id === user.id;
    const action = team.archived_at ? restoreTeam : archiveTeam;
    return (
      <TeamCard
        key={team.id}
        name={team.name}
        season={team.season}
        clubName={team.club_name}
        logoUrl={team.logo_path ? (logoUrls.get(team.logo_path) ?? null) : null}
        primaryColor={team.primary_color}
        secondaryColor={team.secondary_color}
        badge={isHeadCoach ? undefined : m.readOnlyAccess}
        href={`/teams/${team.id}`}
        actions={
          isHeadCoach && (
            <form action={action}>
              <input type="hidden" name="teamId" value={team.id} />
              <button type="submit" className="text-sm text-slate-600 hover:text-brand">
                {team.archived_at ? m.restore : m.archive}
              </button>
            </form>
          )
        }
      />
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <Link
          href="/teams/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          {m.new}
        </Link>
      </div>

      {created === "1" && <Alert tone="success">{m.created}</Alert>}
      {created === "no-logo" && <Alert tone="error">{m.createdWithoutLogo}</Alert>}
      {error && ERRORS[error] && <Alert tone="error">{ERRORS[error]}</Alert>}

      {active.length === 0 && archived.length === 0 ? (
        <p className="text-slate-600">{m.empty}</p>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{m.active}</h2>
          <ul className="space-y-3">{active.map(card)}</ul>
        </section>
      )}

      {archived.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{m.archived}</h2>
          <p className="text-sm text-slate-500">{m.archivedHint}</p>
          <ul className="space-y-3 opacity-75">{archived.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
