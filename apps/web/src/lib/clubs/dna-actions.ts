"use server";

import { type Json } from "@iassistent/db";
import {
  validateClubDna,
  type VisionAnswerError,
} from "@iassistent/staff-engine/content";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { clubDnaQuestionnaire, formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

const m = messages.club.dna;
const SUMMARY_MAX = 2000;

export type DnaFormState = {
  error?: string;
  ok?: string;
  errors?: Record<string, VisionAnswerError>;
};

/** Saves the draft of the club's DNA. The database checks the role and the module. */
export async function saveDnaDraft(
  clubId: string,
  _prev: DnaFormState,
  formData: FormData,
): Promise<DnaFormState> {
  if (!z.uuid().safeParse(clubId).success) return { error: m.errors.failed };
  const summary = String(formData.get("summary") ?? "").trim();
  if (summary.length > SUMMARY_MAX) return { error: m.errors.summaryTooLong };
  const input: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "summary" || typeof value !== "string") continue;
    (input[key] ??= []).push(value);
  }
  const { content, errors } = validateClubDna(
    clubDnaQuestionnaire,
    formationCatalog,
    AGE_CATEGORIES,
    input,
    summary,
  );
  if (Object.keys(errors).length) return { error: m.errors.fixErrors, errors };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_club_dna_draft", {
    p_club_id: clubId,
    p_content: content as unknown as Json,
  });
  if (error) {
    console.error("saveDnaDraft failed", error);
    return {
      error: error.hint === "module_inactive" ? m.moduleOff : m.errors.failed,
    };
  }
  revalidatePath(`/clubs/${clubId}/dna`, "layout");
  return { ok: m.saved };
}

/** Owner or technical director: the draft becomes the club's DNA. */
export async function publishDna(
  clubId: string,
  _prev: DnaFormState,
  formData: FormData,
): Promise<DnaFormState> {
  if (!z.uuid().safeParse(clubId).success) return { error: m.errors.failed };
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 300);
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_club_dna", {
    p_club_id: clubId,
    p_note: note || null,
  });
  if (error) {
    console.error("publishDna failed", error);
    return {
      error:
        error.code === "42501"
          ? m.onlyApprovers
          : error.hint === "no_draft"
            ? m.errors.noDraft
            : m.errors.failed,
    };
  }
  revalidatePath(`/clubs/${clubId}`, "layout");
  return { ok: m.published_ok };
}

export async function discardDnaDraft(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_club_dna_draft", {
    p_club_id: clubId,
  });
  if (error) console.error("discardDnaDraft failed", error);
  revalidatePath(`/clubs/${clubId}/dna`, "layout");
}
