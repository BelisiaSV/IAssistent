import {
  clubAccess,
  clubTeams,
  federationTeams,
  invitationRows,
  pendingInvitations,
} from "@/lib/clubs/people";
import {
  clubFileTemplate,
  type TemplatePerson,
  type TemplateTeam,
} from "@/lib/clubs/template";

/**
 * The club file for the club manager or the platform admin, filled in with the
 * club's teams, the teams of the competition export not used yet and the open
 * invitations.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const access = await clubAccess(clubId);
  if (!access) return new Response(null, { status: 404 });
  const { supabase, admin } = access;

  const [{ data: club }, teams, federation, invitations] = await Promise.all([
    supabase.from("clubs").select("name").eq("id", clubId).maybeSingle(),
    clubTeams(supabase, clubId, admin),
    federationTeams(supabase, clubId),
    pendingInvitations(supabase, clubId),
  ]);
  if (!club) return new Response(null, { status: 404 });

  const active = teams.filter((t) => !t.archived);
  const rows: TemplateTeam[] = active.map((t) => ({
    name: t.name,
    category: t.category,
    federationTeam: t.federationTeam,
  }));
  const used = new Set(active.map((t) => t.federationTeam?.toLowerCase()).filter(Boolean));
  for (const f of federation)
    if (!used.has(f.toLowerCase())) rows.push({ name: f, category: null, federationTeam: f });

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const people: TemplatePerson[] = invitations.flatMap((i) =>
    invitationRows(i, teamName).map((r) => ({
      name: i.name ?? "",
      email: i.email,
      role: r.role,
      team: r.team,
    })),
  );

  const file = await clubFileTemplate(club.name, rows, people, federation);
  const name = `clubbestand-${club.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
