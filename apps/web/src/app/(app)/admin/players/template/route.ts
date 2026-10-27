import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { playerTemplate } from "@/lib/players/template";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

/** The Excel template for the player import; with ?team=… the current squad is filled in. */
export async function GET(request: Request) {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return new Response(null, { status: 404 });

  const team = new URL(request.url).searchParams.get("team");
  let players: Awaited<ReturnType<typeof loadPlayers>> = [];
  let name = "spelers-sjabloon";
  if (team && z.uuid().safeParse(team).success) {
    players = await loadPlayers(supabase, team);
    const { data: teams } = await supabase.rpc("admin_teams");
    const t = (teams ?? []).find((x) => x.id === team);
    if (t) name = `spelers-${t.club_name}-${t.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  const file = await playerTemplate(positionCatalog.posities, players);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

async function loadPlayers(supabase: Awaited<ReturnType<typeof createClient>>, teamId: string) {
  const { data } = await supabase.rpc("admin_team_players", { p_team_id: teamId });
  return data ?? [];
}
