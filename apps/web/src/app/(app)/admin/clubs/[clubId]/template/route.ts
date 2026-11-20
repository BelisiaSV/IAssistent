import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { clubTemplate, type TemplateTeam } from "@/lib/clubs/template";
import { createClient } from "@/lib/supabase/server";

/**
 * The Excel a club fills in, with its details and teams filled in: the club's
 * own teams, plus the teams of the competition export not linked yet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clubId: string }> },
) {
  const { clubId } = await params;
  const supabase = await createClient();
  if (!z.uuid().safeParse(clubId).success || !(await isPlatformAdmin(supabase)))
    return new Response(null, { status: 404 });

  const [{ data: club }, { data: teams }, { data: federation }] =
    await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(),
      supabase.rpc("admin_club_teams", { p_club_id: clubId }),
      supabase.rpc("admin_federation_clubs"),
    ]);
  if (!club) return new Response(null, { status: 404 });

  const rows: TemplateTeam[] = (teams ?? [])
    .filter((t) => !t.archived)
    .map((t) => ({
      name: t.name,
      ageCategory: t.age_category,
      season: t.season,
      federationTeam: t.federation_team,
      divisions: t.federation_divisions,
    }));
  const linked = new Set(
    rows.map((r) => r.federationTeam?.toLowerCase()).filter(Boolean),
  );
  const fromExport = federation?.find(
    (f) => f.number === club.federation_number,
  );
  const exportTeams = Array.isArray(fromExport?.teams)
    ? (fromExport.teams as { name: string; divisions: string[] }[])
    : [];
  for (const t of exportTeams) {
    if (linked.has(t.name.toLowerCase())) continue;
    rows.push({
      name: t.name,
      ageCategory: null,
      season: null,
      federationTeam: t.name,
      divisions: t.divisions ?? [],
    });
  }

  const file = await clubTemplate(
    {
      name: club.name,
      number: club.federation_number,
      address: club.address,
      contactName: club.contact_name,
      contactEmail: club.contact_email,
      contactPhone: club.contact_phone,
      primaryColor: club.primary_color,
      secondaryColor: club.secondary_color,
    },
    rows,
  );
  const name = `club-${club.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
