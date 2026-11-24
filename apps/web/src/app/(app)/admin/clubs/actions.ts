"use server";

import { CLUB_MODULES, type Json } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { createCodeFromForm, reissueCode } from "@/lib/clubs/code";
import type { FederationClub } from "@/lib/clubs/federation";
import type { CodeState, FormState } from "@/lib/clubs/form-state";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const e = messages.clubAdmin.errors;

export type { CodeState, FormState };

async function admin() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return null;
  return supabase;
}

const text = (max: number) => z.string().trim().max(max);
const optionalHex = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/),
]);
const number = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z]{1,10}$/),
]);

/** Stores the clubs found in a calendar export (called by the competition page). */
export async function saveFederationClubs(
  clubs: FederationClub[],
): Promise<{ count?: number; error?: string }> {
  const parsed = z
    .array(
      z.object({
        number: z
          .string()
          .trim()
          .regex(/^[0-9A-Za-z]{1,10}$/),
        name: text(120).min(1),
        teams: z
          .array(
            z.object({
              name: text(120).min(1),
              divisions: z.array(text(20)).max(20),
            }),
          )
          .max(40),
      }),
    )
    .max(2000)
    .safeParse(clubs);
  if (!parsed.success) return { error: e.save };
  const supabase = await admin();
  if (!supabase) return { error: e.notAllowed };
  const { data, error } = await supabase.rpc("admin_save_federation_clubs", {
    p_clubs: parsed.data as unknown as Json,
  });
  if (error) {
    console.error("saveFederationClubs failed", error);
    return { error: e.save };
  }
  revalidatePath("/admin/clubs");
  return { count: data ?? 0 };
}

export async function createClub(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z.object({ name: text(120).min(1), number }).safeParse({
    name: formData.get("name") ?? "",
    number: formData.get("number") ?? "",
  });
  if (!parsed.success) return { error: e.name };
  const supabase = await admin();
  if (!supabase) return { error: e.notAllowed };
  const { data, error } = await supabase.rpc("admin_create_club", {
    p_name: parsed.data.name,
    p_federation_number: parsed.data.number || null,
  });
  if (error || !data) {
    console.error("createClub failed", error);
    return { error: error?.code === "23505" ? e.duplicateNumber : e.save };
  }
  revalidatePath("/admin/clubs");
  redirect(`/admin/clubs/${data}`);
}

export async function updateClub(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      name: text(120).min(1),
      number,
      primaryColor: optionalHex,
      secondaryColor: optionalHex,
      address: text(200),
      contactName: text(120),
      contactEmail: z.union([z.literal(""), z.email().max(200)]),
      contactPhone: text(40),
    })
    .safeParse(
      Object.fromEntries(
        [
          "name",
          "number",
          "primaryColor",
          "secondaryColor",
          "address",
          "contactName",
          "contactEmail",
          "contactPhone",
        ].map((k) => [k, String(formData.get(k) ?? "")]),
      ),
    );
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      error:
        field === "contactEmail"
          ? e.email
          : field === "primaryColor" || field === "secondaryColor"
            ? e.color
            : e.name,
    };
  }
  const supabase = await admin();
  if (!supabase || !z.uuid().safeParse(clubId).success)
    return { error: e.notAllowed };
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_update_club", {
    p_club_id: clubId,
    p_name: d.name,
    p_federation_number: d.number || null,
    p_primary_color: d.primaryColor.toUpperCase() || null,
    p_secondary_color: d.secondaryColor.toUpperCase() || null,
    p_address: d.address || null,
    p_contact_name: d.contactName || null,
    p_contact_email: d.contactEmail || null,
    p_contact_phone: d.contactPhone || null,
  });
  if (error) {
    console.error("updateClub failed", error);
    return { error: error.code === "23505" ? e.duplicateNumber : e.save };
  }
  revalidatePath(`/admin/clubs/${clubId}`);
  return { ok: messages.clubAdmin.details.saved };
}

export async function setSubscription(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const count = z.union([
    z.literal("").transform(() => null),
    z.coerce.number().int().min(0).max(1000),
  ]);
  const date = z.union([z.literal("").transform(() => null), z.iso.date()]);
  const parsed = z
    .object({
      planId: z.union([z.literal("").transform(() => null), z.uuid()]),
      seats: z.coerce.number().int().min(0).max(1000),
      maxTeams: count,
      modules: z.array(z.enum(CLUB_MODULES)),
      startsOn: date,
      endsOn: date,
    })
    .safeParse({
      planId: formData.get("planId") ?? "",
      seats: formData.get("seats") ?? "0",
      maxTeams: formData.get("maxTeams") ?? "",
      modules: formData.getAll("modules"),
      startsOn: formData.get("startsOn") ?? "",
      endsOn: formData.get("endsOn") ?? "",
    });
  if (!parsed.success) return { error: e.save };
  const d = parsed.data;
  if (d.startsOn && d.endsOn && d.endsOn < d.startsOn)
    return { error: e.period };
  const supabase = await admin();
  if (!supabase || !z.uuid().safeParse(clubId).success)
    return { error: e.notAllowed };
  const { error } = await supabase.rpc("admin_set_club_subscription", {
    p_club_id: clubId,
    p_plan_id: d.planId,
    p_license_seats: d.seats,
    p_max_teams: d.maxTeams,
    // No module ticked: the plan's modules.
    p_modules: d.modules.length ? d.modules : null,
    p_starts_on: d.startsOn,
    p_ends_on: d.endsOn,
  });
  if (error) {
    console.error("setSubscription failed", error);
    return { error: e.save };
  }
  revalidatePath(`/admin/clubs/${clubId}`);
  revalidatePath("/admin/clubs");
  return { ok: messages.clubAdmin.subscription.saved };
}

export async function createCode(
  clubId: string,
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const supabase = await admin();
  if (!supabase) return { error: e.notAllowed };
  const result = await createCodeFromForm(supabase, clubId, formData);
  if (result.code) revalidatePath(`/admin/clubs/${clubId}`);
  return result;
}

/** A new code for an open code that got lost. */
export async function reissueAdminCode(
  clubId: string,
  _prev: CodeState,
  formData: FormData,
): Promise<CodeState> {
  const supabase = await admin();
  if (!supabase) return { error: e.notAllowed };
  const result = await reissueCode(
    supabase,
    String(formData.get("codeId") ?? ""),
  );
  if (result.code) revalidatePath(`/admin/clubs/${clubId}`);
  return result;
}

/** Small actions from buttons in a list; the form posts the ids. */
export async function revokeCode(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await admin();
  if (!supabase) return;
  const { error } = await supabase.rpc("revoke_club_activation_code", {
    p_code_id: String(formData.get("codeId")),
  });
  if (error) console.error("revokeCode failed", error);
  revalidatePath(`/admin/clubs/${clubId}`);
}

export async function revokeLicense(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await admin();
  if (!supabase) return;
  const { error } = await supabase.rpc("revoke_club_license", {
    p_license_id: String(formData.get("licenseId")),
  });
  if (error) console.error("revokeLicense failed", error);
  revalidatePath(`/admin/clubs/${clubId}`);
}

export async function createTeam(
  clubId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = z
    .object({
      name: text(120).min(1),
      category: z.enum(AGE_CATEGORIES),
      season: text(20),
    })
    .safeParse({
      name: formData.get("name") ?? "",
      category: formData.get("category"),
      season: formData.get("season") ?? "",
    });
  if (!parsed.success) return { error: e.name };
  const supabase = await admin();
  if (!supabase || !z.uuid().safeParse(clubId).success)
    return { error: e.notAllowed };
  const { error } = await supabase.rpc("create_club_team", {
    p_club_id: clubId,
    p_name: parsed.data.name,
    p_club_name: "",
    p_age_category: parsed.data.category,
    p_season: parsed.data.season || null,
  });
  if (error) {
    console.error("createTeam failed", error);
    return {
      error:
        error.hint === "club_max_teams"
          ? e.maxTeams
          : error.hint === "club_inactive"
            ? e.inactive
            : e.save,
    };
  }
  revalidatePath(`/admin/clubs/${clubId}`);
  return { ok: "" };
}
