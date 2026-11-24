"use server";

import { CLUB_PERSON_ROLES, type Json } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormState } from "@/lib/clubs/form-state";
import {
  type ClubFile,
  hasErrors,
  parseClubFile,
  seatsNeeded,
  toFilePayload,
} from "@/lib/clubs/import";
import { clubAccess, clubMembers, clubTeams, federationTeams } from "@/lib/clubs/people";
import { readClubFile } from "@/lib/clubs/template";
import { messages } from "@/lib/messages";

const m = messages.clubPeople;
const f = m.file;

function refresh(clubId: string) {
  revalidatePath(`/clubs/${clubId}`, "layout");
  revalidatePath(`/admin/clubs/${clubId}`);
}

const errorText = (hint: string | undefined) =>
  (hint && m.errors[hint]) || m.errors.failed!;

const inviteSchema = z.object({
  name: z.string().trim().max(120),
  email: z.email().trim().toLowerCase().max(200),
  role: z.enum(CLUB_PERSON_ROLES),
  team: z.union([z.literal(""), z.uuid()]),
});

/** Club manager or platform admin: invite one person by e-mail. */
export async function inviteClubPerson(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const access = await clubAccess(clubId);
  if (!access) return { error: m.errors.notAllowed };
  const parsed = inviteSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    role: formData.get("role") ?? "",
    team: formData.get("team") ?? "",
  });
  if (!parsed.success) {
    const email = parsed.error.issues.some((i) => i.path[0] === "email");
    return { error: email ? m.errors.invalid_email : m.errors.invalid_role };
  }
  const d = parsed.data;
  const { data, error } = await access.supabase.rpc("save_club_invitation", {
    p_club_id: clubId,
    p_email: d.email,
    p_name: d.name || null,
    p_role: d.role,
    p_team_id: d.team || null,
  });
  if (error) {
    if (!error.hint) console.error("save_club_invitation failed", error);
    return { error: errorText(error.hint) };
  }
  refresh(clubId);
  return { ok: data === "added" ? m.invite.added : m.invite.invited };
}

export async function revokeClubInvitation(clubId: string, id: string) {
  const access = await clubAccess(clubId);
  if (!access || !z.uuid().safeParse(id).success) return;
  const { error } = await access.supabase.rpc("revoke_club_invitation", { p_id: id });
  if (error) console.error("revoke_club_invitation failed", error);
  refresh(clubId);
}

// -----------------------------------------------------------------------------
// The club file
// -----------------------------------------------------------------------------

const MAX_BYTES = 2 * 1024 * 1024;

export type FileState =
  | { error?: string; preview?: undefined; done?: undefined }
  | {
      preview: {
        data: ClubFile;
        existingTeams: string[];
        seatsNeeded: number;
        seatsFree: number;
        blocker: string | null;
      };
      error?: undefined;
      done?: undefined;
    }
  | { done: string; error?: undefined; preview?: undefined };

async function readFile(clubId: string, formData: FormData) {
  const access = await clubAccess(clubId);
  if (!access) return { error: m.errors.notAllowed! } as const;
  const { supabase, admin } = access;
  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_BYTES ||
    !file.name.toLowerCase().endsWith(".xlsx")
  )
    return { error: f.errors.file } as const;
  const sheets = await readClubFile(await file.arrayBuffer());
  if (!sheets) return { error: f.errors.noSheets } as const;

  const [teams, members, federation, { data: subscription }, { data: used }, { data: active }] =
    await Promise.all([
      clubTeams(supabase, clubId, admin),
      clubMembers(supabase, clubId, admin),
      federationTeams(supabase, clubId),
      supabase
        .from("club_subscriptions")
        .select("license_seats, max_teams")
        .eq("club_id", clubId)
        .maybeSingle(),
      supabase.rpc("club_seats_used", { p_club_id: clubId }),
      supabase.rpc("club_is_active", { p_club_id: clubId }),
    ]);
  const existingTeams = teams.filter((t) => !t.archived).map((t) => t.name);
  const parsed = parseClubFile(sheets, existingTeams, federation);
  if ("error" in parsed) return { error: parsed.error } as const;

  const licensed = members
    .filter((p) => p.license_status === "active")
    .map((p) => p.email.toLowerCase());
  const needed = seatsNeeded(parsed.people, licensed);
  const free = Math.max(0, (subscription?.license_seats ?? 0) - (used ?? 0));
  const lower = new Set(existingTeams.map((t) => t.toLowerCase()));
  const newTeams = parsed.teams.filter((t) => !lower.has(t.name.toLowerCase())).length;
  let blocker: string | null = null;
  if (active !== true) blocker = f.inactive;
  else if (
    subscription?.max_teams != null &&
    existingTeams.length + newTeams > subscription.max_teams
  )
    blocker = f.tooManyTeams;
  return { supabase, data: parsed, existingTeams, needed, free, blocker } as const;
}

/** Reads and checks the file; nothing is saved. */
export async function checkClubFile(
  clubId: string,
  _prev: FileState,
  formData: FormData,
): Promise<FileState> {
  const r = await readFile(clubId, formData);
  if ("error" in r) return { error: r.error };
  return {
    preview: {
      data: r.data,
      existingTeams: r.existingTeams,
      seatsNeeded: r.needed,
      seatsFree: r.free,
      blocker: r.blocker,
    },
  };
}

/** Imports the file (the same one that was checked). */
export async function importClubFile(
  clubId: string,
  _prev: FileState,
  formData: FormData,
): Promise<FileState> {
  const r = await readFile(clubId, formData);
  if ("error" in r) return { error: r.error };
  if (hasErrors(r.data) || r.blocker) return { error: r.blocker ?? f.fixErrors };
  const { data, error } = await r.supabase.rpc("import_club_file", {
    p_club_id: clubId,
    p_data: toFilePayload(r.data) as unknown as Json,
  });
  if (error || !data) {
    if (!error?.hint) console.error("import_club_file failed", error);
    return { error: error?.hint ? errorText(error.hint) : f.errors.failed };
  }
  const result = data as {
    teams_created: number;
    teams_updated: number;
    invited: number;
    added: number;
  };
  refresh(clubId);
  return {
    done: f.done(result.teams_created, result.teams_updated, result.invited, result.added),
  };
}
