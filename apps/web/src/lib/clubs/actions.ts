"use server";

import { TEAM_STAFF_ROLES } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import { createCodeFromForm, reissueCode } from "./code";
import type { CodeState, FormState } from "./form-state";

const j = messages.club.join.errors;
const s = messages.club.structure.errors;

/**
 * The club's own actions. Every database function checks the user's role in
 * the club itself; these only validate the input.
 */
async function client() {
  await requireUser();
  return createClient();
}

const uuid = z.uuid();

export async function redeemCode(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = String(formData.get("code") ?? "").trim();
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 12)
    return { error: j.invalid };
  const supabase = await client();
  const { data, error } = await supabase.rpc("redeem_club_activation_code", {
    p_code: code,
  });
  const result = data as {
    ok: boolean;
    club_id?: string;
    error?: string;
  } | null;
  if (error || !result) {
    console.error("redeemCode failed", error);
    return { error: j.failed };
  }
  if (!result.ok || !result.club_id)
    return { error: j[result.error ?? "failed"] ?? j.failed };
  revalidatePath("/", "layout");
  redirect(`/clubs/${result.club_id}`);
}

export async function createClubCode(
  clubId: string,
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const supabase = await client();
  const result = await createCodeFromForm(supabase, clubId, formData);
  if (result.code) revalidatePath(`/clubs/${clubId}/licenses`);
  return result;
}

/** A new code for an open code that got lost. */
export async function reissueClubCode(
  clubId: string,
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const supabase = await client();
  const result = await reissueCode(
    supabase,
    String(formData.get("codeId") ?? ""),
  );
  if (result.code) revalidatePath(`/clubs/${clubId}/licenses`);
  return result;
}

/**
 * The full code of an open activation code (the eye in the codes table), for
 * those who may revoke it; the database checks it and logs it.
 */
export async function revealClubCode(codeId: string): Promise<CodeState> {
  if (!uuid.safeParse(codeId).success)
    return { error: messages.clubAdmin.codes.errors.failed };
  const supabase = await client();
  const { data, error } = await supabase.rpc("reveal_club_activation_code", {
    p_code_id: codeId,
  });
  if (error) {
    console.error("reveal_club_activation_code failed", error);
    return { error: messages.clubAdmin.codes.errors.failed };
  }
  if (!data) return { error: messages.clubAdmin.codes.notKept };
  return { code: data };
}

/** Small list actions; the form posts the ids. */
export async function revokeClubCode(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("revoke_club_activation_code", {
    p_code_id: String(formData.get("codeId")),
  });
  if (error) console.error("revokeClubCode failed", error);
  revalidatePath(`/clubs/${clubId}/licenses`);
}

export async function revokeClubLicense(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("revoke_club_license", {
    p_license_id: String(formData.get("licenseId")),
  });
  if (error) console.error("revokeClubLicense failed", error);
  revalidatePath(`/clubs/${clubId}`, "layout");
}

export async function endClubRole(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("end_club_role", {
    p_member_id: String(formData.get("memberId")),
  });
  if (error) console.error("endClubRole failed", error);
  revalidatePath(`/clubs/${clubId}`, "layout");
}

export async function createClubTeam(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      clubId: uuid,
      name: z.string().trim().min(1).max(120),
      category: z.enum(AGE_CATEGORIES),
      season: z.string().trim().max(20),
    })
    .safeParse({
      clubId,
      name: formData.get("name") ?? "",
      category: formData.get("category"),
      season: formData.get("season") ?? "",
    });
  if (!parsed.success) return { error: messages.clubAdmin.errors.name };
  const supabase = await client();
  const { error } = await supabase.rpc("create_club_team", {
    p_club_id: clubId,
    p_name: parsed.data.name,
    p_club_name: "",
    p_age_category: parsed.data.category,
    p_season: parsed.data.season || null,
  });
  if (error) {
    console.error("createClubTeam failed", error);
    return { error: error.hint === "club_max_teams" ? s.maxTeams : s.failed };
  }
  revalidatePath(`/clubs/${clubId}`, "layout");
  revalidatePath("/", "layout");
  return { ok: "" };
}

export async function assignStaff(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({ teamId: uuid, coachId: uuid, role: z.enum(TEAM_STAFF_ROLES) })
    .safeParse({
      teamId: formData.get("teamId"),
      coachId: formData.get("coachId"),
      role: formData.get("role"),
    });
  if (!parsed.success) return { error: s.failed };
  const supabase = await client();
  const { error } = await supabase.rpc("assign_team_staff", {
    p_team_id: parsed.data.teamId,
    p_coach_id: parsed.data.coachId,
    p_role: parsed.data.role,
  });
  if (error) {
    console.error("assignStaff failed", error);
    return { error: error.hint === "no_club_role" ? s.noRole : s.failed };
  }
  revalidatePath(`/clubs/${clubId}`, "layout");
  return { ok: "" };
}

export async function endStaff(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("end_team_staff", {
    p_staff_id: String(formData.get("staffId")),
  });
  if (error) console.error("endStaff failed", error);
  revalidatePath(`/clubs/${clubId}`, "layout");
}

export async function decideLink(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("decide_club_team_link", {
    p_link_id: String(formData.get("linkId")),
    p_approve: formData.get("approve") === "1",
  });
  if (error) console.error("decideLink failed", error);
  revalidatePath(`/clubs/${clubId}`, "layout");
  revalidatePath("/", "layout");
}

export async function requestLink(
  teamId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const clubId = String(formData.get("clubId") ?? "");
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(clubId).success)
    return { error: messages.club.link.failed };
  const supabase = await client();
  const federationTeam = String(formData.get("federationTeam") ?? "")
    .trim()
    .slice(0, 120);
  const { error } = await supabase.rpc("request_club_team_link", {
    p_team_id: teamId,
    p_club_id: clubId,
    p_federation_team: federationTeam || null,
  });
  if (error) {
    console.error("requestLink failed", error);
    return { error: messages.club.link.failed };
  }
  revalidatePath(`/teams/${teamId}/settings`);
  return { ok: "" };
}

export async function cancelLink(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const supabase = await client();
  const { error } = await supabase.rpc("cancel_club_team_link", {
    p_link_id: String(formData.get("linkId")),
  });
  if (error) console.error("cancelLink failed", error);
  revalidatePath(`/teams/${teamId}/settings`);
}
