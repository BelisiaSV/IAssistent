"use server";

import { TEAM_LOGOS_BUCKET } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { checkLogo, teamInputSchema } from "@/lib/teams/validation";

export type TeamFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "season" | "clubName" | "primaryColor" | "secondaryColor" | "logo", string>>;
};

const LICENSE_HINT = "license_seats_exhausted";

export async function createTeam(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const parsed = teamInputSchema.safeParse({
    name: formData.get("name") ?? "",
    season: formData.get("season") ?? "",
    clubName: formData.get("clubName") ?? "",
    primaryColor: formData.get("primaryColor") ?? "",
    secondaryColor: formData.get("secondaryColor") ?? "",
  });

  const logo = formData.get("logo");
  const logoFile = logo instanceof File ? logo : null;
  const logoBytes = logoFile && logoFile.size > 0 ? new Uint8Array(await logoFile.arrayBuffer()) : null;
  const logoCheck = checkLogo(logoFile?.size ?? 0, logoBytes?.subarray(0, 16) ?? new Uint8Array());

  if (!parsed.success || !logoCheck.ok) {
    const fieldErrors: TeamFormState["fieldErrors"] = {};
    for (const issue of parsed.error?.issues ?? []) {
      const key = issue.path[0] as keyof NonNullable<TeamFormState["fieldErrors"]>;
      fieldErrors[key] ??= issue.message;
    }
    if (!logoCheck.ok) fieldErrors.logo = logoCheck.error;
    return { fieldErrors };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const input = parsed.data;

  const { data: team, error } = await supabase
    .from("teams")
    .insert({
      head_coach_id: user.id,
      name: input.name,
      season: input.season,
      club_name: input.clubName,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
    })
    .select("id")
    .single();

  if (error || !team) {
    return {
      error: error?.hint === LICENSE_HINT ? messages.teams.errors.noLicenseSeats : messages.teamForm.errors.saveFailed,
    };
  }

  let logoFailed = false;
  if (logoCheck.kind && logoBytes) {
    const path = `${team.id}/logo.${logoCheck.kind.extension}`;
    const upload = await supabase.storage
      .from(TEAM_LOGOS_BUCKET)
      .upload(path, logoBytes, { contentType: logoCheck.kind.mimeType, upsert: true });
    const update = upload.error
      ? null
      : await supabase.from("teams").update({ logo_path: path }).eq("id", team.id);
    logoFailed = Boolean(upload.error || update?.error);
  }

  revalidatePath("/teams");
  redirect(`/teams?created=${logoFailed ? "no-logo" : "1"}`);
}

async function setArchived(teamId: string, archived: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", teamId)
    .select("id");

  revalidatePath("/teams");
  if (error || !data?.length) {
    const reason = error?.hint === LICENSE_HINT ? "license" : archived ? "archive" : "restore";
    redirect(`/teams?error=${reason}`);
  }
}

export async function archiveTeam(formData: FormData) {
  await setArchived(String(formData.get("teamId")), true);
}

export async function restoreTeam(formData: FormData) {
  await setArchived(String(formData.get("teamId")), false);
}
