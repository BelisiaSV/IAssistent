"use server";

import { type Json } from "@iassistent/db";
import { validateVisionAnswers, type VisionAnswerError } from "@iassistent/staff-engine/content";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { formationCatalog, visionQuestionnaire } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

export type VisionFormState = {
  error?: string;
  success?: string;
  errors?: Record<string, VisionAnswerError>;
  summaryError?: string;
};

const SUMMARY_MAX = 2000;
const e = messages.vision.errors;

export async function saveVision(_prev: VisionFormState, formData: FormData): Promise<VisionFormState> {
  const summary = String(formData.get("summary") ?? "").trim();
  if (summary.length > SUMMARY_MAX) return { summaryError: e.summaryTooLong, error: e.fixErrors };

  const input: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "summary" || typeof value !== "string") continue;
    (input[key] ??= []).push(value);
  }

  const { answers, errors } = validateVisionAnswers(visionQuestionnaire, formationCatalog, input);
  if (Object.keys(errors).length > 0) return { errors, error: e.fixErrors };

  const user = await requireUser();
  const supabase = await createClient();
  const vision = { versie: visionQuestionnaire.versie, antwoorden: answers } satisfies Json;
  const { data, error } = await supabase
    .from("coach_profiles")
    .update({ vision_summary: summary === "" ? null : summary, vision })
    .eq("coach_id", user.id)
    .select("coach_id");

  if (error || !data?.length) {
    console.error("saveVision failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath("/profile/vision");
  return { success: messages.vision.saved };
}
