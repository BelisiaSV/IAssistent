"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { planFromForm, planRow } from "@/lib/plans/plans";
import { createClient } from "@/lib/supabase/server";

export type PlanFormState = { error?: string; success?: string };

const e = messages.plans.errors;

function revalidate() {
  revalidatePath("/admin/plans");
  revalidatePath("/account");
}

/** Creates a plan (planId null) or updates one. Admins only (RLS checks it too). */
export async function savePlan(planId: string | null, _prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  if (planId !== null && !z.uuid().safeParse(planId).success) return { error: e.saveFailed };
  const parsed = planFromForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? e.saveFailed };

  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.saveFailed };
  const row = planRow(parsed.data);
  const { error } = planId ? await supabase.from("plans").update(row).eq("id", planId) : await supabase.from("plans").insert(row);
  if (error) {
    if (error.code !== "23505") console.error("savePlan failed", error);
    return { error: error.code === "23505" ? e.codeTaken : e.saveFailed };
  }
  revalidate();
  return { success: messages.plans.saved };
}

export async function deletePlan(formData: FormData) {
  const planId = String(formData.get("planId") ?? "");
  if (!z.uuid().safeParse(planId).success) return;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("plans").delete().eq("id", planId);
  if (error) console.error("deletePlan failed", error);
  revalidate();
}

/** Assigns a plan (or none) to an account. */
export async function setAccountPlan(formData: FormData) {
  const coachId = String(formData.get("coachId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  if (!z.uuid().safeParse(coachId).success || (planId !== "" && !z.uuid().safeParse(planId).success)) return;
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_plan", { p_coach: coachId, p_plan: planId || null });
  if (error) console.error("setAccountPlan failed", error);
  revalidatePath("/admin/accounts");
  revalidatePath("/account");
}
