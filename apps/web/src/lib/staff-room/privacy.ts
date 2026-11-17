import "server-only";

import { messages } from "@/lib/messages";
import { withoutNames } from "@/lib/proposals/names";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * A filter for texts of the head coach that go to the AI: player names of the
 * team become shirt numbers (the AI never gets names). The app keeps showing
 * the text as he wrote it.
 */
export async function nameFilter(supabase: Supabase, teamId: string): Promise<(text: string) => string> {
  const { data } = await supabase.from("players").select("shirt_number, first_name, last_name").eq("team_id", teamId);
  const players = data ?? [];
  return (text: string) => withoutNames(text, players, messages.staffRoom.unknownPlayer);
}
