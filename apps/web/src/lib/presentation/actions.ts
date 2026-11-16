"use server";

import { TEAM_MEDIA_BUCKET } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { opponentKey } from "@/lib/opponents/context";
import { opponentNameSchema } from "@/lib/opponents/validation";
import { createClient } from "@/lib/supabase/server";
import { checkLogo } from "@/lib/teams/validation";

const e = messages.presentation.errors;
const uuid = z.uuid();

export type MediaResult = { ok?: true; error?: string };

/**
 * Uploads the logo of an opponent (also one the team never plays, e.g. a
 * recent opponent of the next opponent): makes the opponent fiche when it
 * does not exist yet.
 */
export async function uploadOpponentLogo(
  teamId: string,
  opponentName: string,
  formData: FormData,
): Promise<MediaResult> {
  const name = opponentNameSchema.safeParse(opponentName);
  const file = formData.get("logo");
  if (
    !uuid.safeParse(teamId).success ||
    !name.success ||
    !(file instanceof File)
  )
    return { error: e.logo };
  const check = checkLogo(
    file.size,
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  if (!check.ok) return { error: check.error };
  if (!check.kind) return { error: e.logo };

  await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("opponents")
    .select("id, name, logo_path")
    .eq("team_id", teamId);
  let opponent = (existing ?? []).find(
    (o) => opponentKey(o.name) === opponentKey(name.data),
  );
  if (!opponent) {
    const { data, error } = await supabase
      .from("opponents")
      .insert({ team_id: teamId, name: name.data })
      .select("id, name, logo_path")
      .single();
    if (error || !data) {
      if (error?.code !== "42501")
        console.error("uploadOpponentLogo: opponent failed", error);
      return { error: error?.code === "42501" ? e.readOnly : e.logo };
    }
    opponent = data;
  }
  const path = `${teamId}/opponents/${opponent.id}-${Date.now()}.${check.kind.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(TEAM_MEDIA_BUCKET)
    .upload(path, file, { contentType: check.kind.mimeType });
  if (uploadError) {
    console.error("uploadOpponentLogo: upload failed", uploadError);
    return { error: e.logo };
  }
  await supabase
    .from("opponents")
    .update({ logo_path: path })
    .eq("id", opponent.id);
  if (opponent.logo_path)
    await supabase.storage.from(TEAM_MEDIA_BUCKET).remove([opponent.logo_path]);
  revalidatePath(`/teams/${teamId}/presentation`);
  revalidatePath(`/teams/${teamId}/opponents/${opponent.id}`);
  return { ok: true };
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Stores the shirt colours of an opponent (makes the fiche when it does not exist yet). */
export async function saveOpponentShirt(
  teamId: string,
  opponentName: string,
  shirt: string,
  trim: string,
): Promise<MediaResult> {
  const name = opponentNameSchema.safeParse(opponentName);
  if (
    !uuid.safeParse(teamId).success ||
    !name.success ||
    !hex.safeParse(shirt).success ||
    !hex.safeParse(trim).success
  )
    return { error: e.shirt };
  await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("opponents")
    .select("id, name")
    .eq("team_id", teamId);
  const opponent = (existing ?? []).find(
    (o) => opponentKey(o.name) === opponentKey(name.data),
  );
  const { error } = opponent
    ? await supabase
        .from("opponents")
        .update({ shirt_color: shirt, shirt_trim_color: trim })
        .eq("id", opponent.id)
    : await supabase
        .from("opponents")
        .insert({
          team_id: teamId,
          name: name.data,
          shirt_color: shirt,
          shirt_trim_color: trim,
        });
  if (error) {
    if (error.code !== "42501")
      console.error("saveOpponentShirt failed", error);
    return { error: error.code === "42501" ? e.readOnly : e.shirt };
  }
  revalidatePath(`/teams/${teamId}/presentation`);
  return { ok: true };
}
