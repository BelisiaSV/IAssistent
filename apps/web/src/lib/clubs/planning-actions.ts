"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import type { FormState } from "./form-state";

const e = messages.club.planning.errors;

const periodSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
    age_categories: z.array(z.enum(AGE_CATEGORIES)),
    goals: z.array(z.string().trim().min(1).max(200)).max(10),
    focus: z.string().trim().max(600),
  })
  .refine((p) => p.ends_on >= p.starts_on);

/** Owner, admin or technical director: create (periodId null) or change a period of the club planning. */
export async function savePeriod(
  clubId: string,
  periodId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = periodSchema.safeParse({
    title: formData.get("title"),
    starts_on: formData.get("startsOn"),
    ends_on: formData.get("endsOn"),
    age_categories: formData.getAll("categories").map(String),
    goals: String(formData.get("goals") ?? "")
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean),
    focus: formData.get("focus") ?? "",
  });
  if (!parsed.success || !z.uuid().safeParse(clubId).success) return { error: e.invalid };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_club_period", {
    p_club_id: clubId,
    p_id: periodId,
    p_data: parsed.data,
  });
  if (error) {
    console.error("savePeriod failed", error);
    return { error: error.hint === "module_inactive" ? e.module : e.failed };
  }
  revalidatePath(`/clubs/${clubId}/planning`);
  return { ok: messages.club.planning.saved };
}

export async function deletePeriod(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_club_period", { p_id: String(formData.get("periodId")) });
  if (error) console.error("deletePeriod failed", error);
  revalidatePath(`/clubs/${clubId}/planning`);
}
