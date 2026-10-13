"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { lineupDetailsSchema, parseLineupPlayers } from "@/lib/lineups/validation";
import { messages } from "@/lib/messages";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type LineupFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const e = messages.lineups.errors;
const uuid = z.uuid();
const formationCodes = formationCatalog.formaties.map((f) => f.code);

function detailsFrom(formData: FormData) {
  return lineupDetailsSchema(formationCodes).safeParse({
    title: String(formData.get("title") ?? ""),
    matchDate: String(formData.get("matchDate") ?? ""),
    opponent: String(formData.get("opponent") ?? ""),
    formation: String(formData.get("formation") ?? ""),
  });
}

function fieldErrors(error: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of error.issues) result[String(issue.path[0])] ??= issue.message;
  return result;
}

export async function createLineup(
  teamId: string,
  _prev: LineupFormState,
  formData: FormData,
): Promise<LineupFormState> {
  if (!uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const details = detailsFrom(formData);
  if (!details.success) return { fieldErrors: fieldErrors(details.error) };

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lineups")
    .insert({
      team_id: teamId,
      title: details.data.title,
      match_date: details.data.matchDate,
      opponent: details.data.opponent,
      formation: details.data.formation,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createLineup failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(`/teams/${teamId}/lineups`);
  redirect(`/teams/${teamId}/lineups/${data.id}`);
}

export async function saveLineup(
  teamId: string,
  lineupId: string,
  _prev: LineupFormState,
  formData: FormData,
): Promise<LineupFormState> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(lineupId).success) {
    return { error: e.saveFailed };
  }
  const details = detailsFrom(formData);
  if (!details.success) return { fieldErrors: fieldErrors(details.error) };
  const formation = formationCatalog.formaties.find((f) => f.code === details.data.formation)!;

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("players") ?? ""));
  } catch {
    return { error: e.invalid };
  }

  await requireUser();
  const supabase = await createClient();
  const { data: squad } = await supabase.from("players").select("id").eq("team_id", teamId);
  const players = parseLineupPlayers(raw, formation, new Set((squad ?? []).map((p) => p.id)));
  if (!players) return { error: e.invalid };

  const { data, error } = await supabase
    .from("lineups")
    .update({
      title: details.data.title,
      match_date: details.data.matchDate,
      opponent: details.data.opponent,
      formation: formation.code,
      starters: players.starters,
      bench: players.bench,
    })
    .eq("id", lineupId)
    .eq("team_id", teamId)
    .select("id");

  if (error || !data?.length) {
    console.error("saveLineup failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(`/teams/${teamId}/lineups`);
  return { success: messages.common.saved };
}

export async function deleteLineup(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const lineupId = String(formData.get("lineupId"));
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(lineupId).success) return;

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("lineups").delete().eq("id", lineupId).eq("team_id", teamId);
  if (error) console.error("deleteLineup failed", error);
  revalidatePath(`/teams/${teamId}/lineups`);
  redirect(`/teams/${teamId}/lineups`);
}
