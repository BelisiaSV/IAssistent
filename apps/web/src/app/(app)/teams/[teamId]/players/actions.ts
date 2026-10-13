"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { PLAYER_STATUSES, playerFormValues, playerInputSchema } from "@/lib/players/validation";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type PlayerFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const e = messages.players.errors;
const positionCodes = positionCatalog.posities.map((p) => p.code);
const uuid = z.uuid();

export async function savePlayer(
  teamId: string,
  playerId: string | null,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  if (!uuid.safeParse(teamId).success || (playerId && !uuid.safeParse(playerId).success)) {
    return { error: e.saveFailed };
  }

  const parsed = playerInputSchema(positionCodes).safeParse(playerFormValues(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  await requireUser();
  const supabase = await createClient();
  const p = parsed.data;
  const values = {
    first_name: p.firstName,
    last_name: p.lastName,
    shirt_number: p.shirtNumber,
    primary_position: p.primaryPosition,
    secondary_positions: p.secondaryPositions,
    preferred_foot: p.preferredFoot,
    birth_year: p.birthYear,
    joined_club_year: p.joinedClubYear,
    status: p.status,
    expected_return_date: p.expectedReturnDate,
    notes: p.notes,
  };

  const { data, error } = playerId
    ? await supabase.from("players").update(values).eq("id", playerId).eq("team_id", teamId).select("id")
    : await supabase.from("players").insert({ ...values, team_id: teamId }).select("id");

  if (error?.code === "23505") return { fieldErrors: { shirtNumber: e.shirtNumberTaken } };
  if (error || !data?.length) {
    console.error("savePlayer failed", error);
    return { error: e.saveFailed };
  }

  revalidatePath(`/teams/${teamId}`, "layout");
  redirect(`/teams/${teamId}/players`);
}

const statusSchema = z.object({
  teamId: z.uuid(),
  playerId: z.uuid(),
  status: z.enum(PLAYER_STATUSES),
});

export async function setPlayerStatus(formData: FormData) {
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { teamId, playerId, status } = parsed.data;

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update(status === "injured" ? { status } : { status, expected_return_date: null })
    .eq("id", playerId)
    .eq("team_id", teamId);
  if (error) console.error("setPlayerStatus failed", error);
  revalidatePath(`/teams/${teamId}`, "layout");
}

async function setArchived(formData: FormData, archived: boolean) {
  const teamId = String(formData.get("teamId"));
  const playerId = String(formData.get("playerId"));
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(playerId).success) return;

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", playerId)
    .eq("team_id", teamId);
  if (error) console.error("setArchived (player) failed", error);
  revalidatePath(`/teams/${teamId}`, "layout");
  redirect(`/teams/${teamId}/players`);
}

export async function archivePlayer(formData: FormData) {
  await setArchived(formData, true);
}

export async function restorePlayer(formData: FormData) {
  await setArchived(formData, false);
}
