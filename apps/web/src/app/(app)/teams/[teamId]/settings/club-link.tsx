import { loadMyClubs } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { ClubLinkForm } from "./club-link-form";

const m = messages.club.link;

/**
 * Club of the team: for a club team, which club; for an active personal team
 * of a coach in a club, a request to bring it into the club (or the pending one).
 */
export async function ClubLink({
  team,
  canEdit,
}: {
  team: { id: string; club_id: string | null; archived_at: string | null };
  canEdit: boolean;
}) {
  const supabase = await createClient();
  const clubs = await loadMyClubs();
  if (team.club_id) {
    const club = clubs.find((c) => c.id === team.club_id);
    const { data } = club
      ? { data: club }
      : await supabase
          .from("clubs")
          .select("id, name")
          .eq("id", team.club_id)
          .maybeSingle();
    return (
      <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">{m.title}</h2>
        <p className="text-sm text-slate-600">{m.clubTeam(data?.name ?? "")}</p>
      </section>
    );
  }
  if (!canEdit || team.archived_at) return null;
  const coachClubs = clubs.filter((c) =>
    c.roles.some((r) => r === "coach" || r === "assistant_coach"),
  );
  const { data: pending } = await supabase
    .from("club_team_links")
    .select("id, club_id")
    .eq("team_id", team.id)
    .eq("status", "pending")
    .maybeSingle();
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{m.title}</h2>
      <p className="text-sm text-slate-600">{m.intro}</p>
      <ClubLinkForm
        teamId={team.id}
        clubs={coachClubs.map((c) => ({ id: c.id, name: c.name }))}
        pending={
          pending
            ? {
                id: pending.id,
                clubName:
                  clubs.find((c) => c.id === pending.club_id)?.name ?? "",
              }
            : null
        }
      />
    </section>
  );
}
