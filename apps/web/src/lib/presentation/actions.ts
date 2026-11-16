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
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
/** Same limit as the bucket. */
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export type MediaResult = { ok?: true; error?: string };

/**
 * Uploads the logo of an opponent (also one the team never plays, e.g. a
 * recent opponent of the next opponent): makes the opponent fiche when it
 * does not exist yet.
 */
export async function uploadOpponentLogo(teamId: string, opponentName: string, formData: FormData): Promise<MediaResult> {
  const name = opponentNameSchema.safeParse(opponentName);
  const file = formData.get("logo");
  if (!uuid.safeParse(teamId).success || !name.success || !(file instanceof File)) return { error: e.logo };
  const check = checkLogo(file.size, new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!check.ok) return { error: check.error };
  if (!check.kind) return { error: e.logo };

  await requireUser();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("opponents").select("id, name, logo_path").eq("team_id", teamId);
  let opponent = (existing ?? []).find((o) => opponentKey(o.name) === opponentKey(name.data));
  if (!opponent) {
    const { data, error } = await supabase.from("opponents").insert({ team_id: teamId, name: name.data }).select("id, name, logo_path").single();
    if (error || !data) {
      if (error?.code !== "42501") console.error("uploadOpponentLogo: opponent failed", error);
      return { error: error?.code === "42501" ? e.readOnly : e.logo };
    }
    opponent = data;
  }
  const path = `${teamId}/opponents/${opponent.id}-${Date.now()}.${check.kind.extension}`;
  const { error: uploadError } = await supabase.storage.from(TEAM_MEDIA_BUCKET).upload(path, file, { contentType: check.kind.mimeType });
  if (uploadError) {
    console.error("uploadOpponentLogo: upload failed", uploadError);
    return { error: e.logo };
  }
  await supabase.from("opponents").update({ logo_path: path }).eq("id", opponent.id);
  if (opponent.logo_path) await supabase.storage.from(TEAM_MEDIA_BUCKET).remove([opponent.logo_path]);
  revalidatePath(`/teams/${teamId}/presentation`);
  revalidatePath(`/teams/${teamId}/opponents/${opponent.id}`);
  return { ok: true };
}

/** A signed URL to upload the cover photo or team photo straight from the browser (photos are large). */
export async function prepareTeamPhotoUpload(
  teamId: string,
  kind: "cover" | "team",
  file: { type: string; size: number },
): Promise<{ path: string; token: string } | { error: string }> {
  const ext = PHOTO_TYPES[file.type as keyof typeof PHOTO_TYPES];
  if (!uuid.safeParse(teamId).success || !["cover", "team"].includes(kind) || !ext) return { error: e.photoType };
  if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) return { error: e.photoSize };
  await requireUser();
  const supabase = await createClient();
  const { data: canWrite } = await supabase.rpc("can_write_team", { p_team_id: teamId });
  if (!canWrite) return { error: e.readOnly };
  const path = `${teamId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(TEAM_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("prepareTeamPhotoUpload failed", error);
    return { error: e.photo };
  }
  return { path, token: data.token };
}

/** Stores an uploaded photo on the team and removes the previous one. */
export async function saveTeamPhoto(teamId: string, kind: "cover" | "team", path: string | null): Promise<MediaResult> {
  if (!uuid.safeParse(teamId).success || !["cover", "team"].includes(kind)) return { error: e.photo };
  if (path !== null && !path.startsWith(`${teamId}/${kind}-`)) return { error: e.photo };
  await requireUser();
  const supabase = await createClient();
  const column = kind === "cover" ? "cover_photo_path" : "team_photo_path";
  const { data: team } = await supabase.from("teams").select("cover_photo_path, team_photo_path").eq("id", teamId).maybeSingle();
  if (!team) return { error: e.photo };
  const { error } = await supabase
    .from("teams")
    .update(kind === "cover" ? { cover_photo_path: path } : { team_photo_path: path })
    .eq("id", teamId);
  if (error) {
    console.error("saveTeamPhoto failed", error);
    return { error: e.photo };
  }
  const previous = team[column];
  if (previous && previous !== path) await supabase.storage.from(TEAM_MEDIA_BUCKET).remove([previous]);
  revalidatePath(`/teams/${teamId}/settings`);
  revalidatePath(`/teams/${teamId}/presentation`);
  return { ok: true };
}
