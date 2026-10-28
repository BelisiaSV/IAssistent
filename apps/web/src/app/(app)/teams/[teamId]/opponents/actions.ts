"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { compactLineup, opponentFicheSchema, opponentLineupSchema, opponentNameSchema } from "@/lib/opponents/validation";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type OpponentFormState = { error?: string; success?: string };

const e = messages.opponents.errors;
const uuid = z.uuid();
const isoDate = z.union([z.literal("").transform(() => null), z.iso.date()]);

const opponentPath = (teamId: string, opponentId?: string) =>
  `/teams/${teamId}/opponents${opponentId ? `/${opponentId}` : ""}`;

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value ?? ""));
  } catch {
    return undefined;
  }
}

export async function createOpponent(
  teamId: string,
  _prev: OpponentFormState,
  formData: FormData,
): Promise<OpponentFormState> {
  if (!uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const name = opponentNameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!name.success) return { error: e.name };

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opponents")
    .insert({ team_id: teamId, name: name.data })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code !== "23505") console.error("createOpponent failed", error);
    return { error: error?.code === "23505" ? e.exists : e.saveFailed };
  }
  revalidatePath(opponentPath(teamId));
  redirect(opponentPath(teamId, data.id));
}

export async function saveOpponentFiche(
  teamId: string,
  opponentId: string,
  _prev: OpponentFormState,
  formData: FormData,
): Promise<OpponentFormState> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(opponentId).success) return { error: e.saveFailed };
  const parsed = opponentFicheSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    playStyle: String(formData.get("playStyle") ?? ""),
    strengths: String(formData.get("strengths") ?? ""),
    weaknesses: String(formData.get("weaknesses") ?? ""),
    setPieces: String(formData.get("setPieces") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    coachName: String(formData.get("coachName") ?? ""),
    address: String(formData.get("address") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };

  await requireUser();
  const supabase = await createClient();
  const f = parsed.data;
  const { data, error } = await supabase
    .from("opponents")
    .update({
      name: f.name,
      play_style: f.playStyle,
      strengths: f.strengths,
      weaknesses: f.weaknesses,
      set_pieces: f.setPieces,
      notes: f.notes,
      coach_name: f.coachName,
      address: f.address,
    })
    .eq("id", opponentId)
    .eq("team_id", teamId)
    .select("id");
  if (error || !data?.length) {
    if (error?.code !== "23505") console.error("saveOpponentFiche failed", error);
    return { error: error?.code === "23505" ? e.exists : e.saveFailed };
  }
  revalidatePath(opponentPath(teamId), "layout");
  return { success: messages.opponents.saved };
}

/**
 * Stores the opponent lineup. One lineup per match date: saving for a date
 * that already has a lineup updates it.
 */
export async function saveOpponentLineup(
  teamId: string,
  opponentId: string,
  _prev: OpponentFormState,
  formData: FormData,
): Promise<OpponentFormState> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(opponentId).success) return { error: e.saveFailed };
  const parsed = opponentLineupSchema.safeParse(parseJson(formData.get("lineup")));
  const matchDate = isoDate.safeParse(String(formData.get("matchDate") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };
  if (!matchDate.success) return { error: e.saveFailed };
  const formation = formationCatalog.formaties.find((f) => f.code === parsed.data.formation);
  if (!formation) return { error: e.formation };
  const lineup = compactLineup(parsed.data, new Set(formation.posten.map((s) => s.id)));

  await requireUser();
  const supabase = await createClient();
  let existingQuery = supabase
    .from("opponent_lineups")
    .select("id")
    .eq("opponent_id", opponentId)
    .eq("team_id", teamId)
    .eq("source", "coach");
  existingQuery = matchDate.data ? existingQuery.eq("match_date", matchDate.data) : existingQuery.is("match_date", null);
  const { data: existing } = await existingQuery.limit(1).maybeSingle();

  const row = {
    formation: lineup.formation,
    starters: lineup.starters,
    bench: lineup.bench,
    match_date: matchDate.data,
  };
  const { error } = existing
    ? await supabase.from("opponent_lineups").update(row).eq("id", existing.id)
    : await supabase.from("opponent_lineups").insert({ ...row, team_id: teamId, opponent_id: opponentId });
  if (error) {
    console.error("saveOpponentLineup failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(opponentPath(teamId, opponentId));
  return { success: messages.opponents.saved };
}

export async function deleteOpponent(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const opponentId = String(formData.get("opponentId"));
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(opponentId).success) return;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("opponents").delete().eq("id", opponentId).eq("team_id", teamId);
  if (error) {
    console.error("deleteOpponent failed", error);
    return;
  }
  revalidatePath(opponentPath(teamId));
  redirect(opponentPath(teamId));
}
