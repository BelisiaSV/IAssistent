"use server";

import type { Json } from "@iassistent/db";
import { CLUB_DOCUMENTS_BUCKET } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES, ageCategory } from "@/lib/teams/age-categories";

import type { FormState } from "./form-state";
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, trainingDaySnapshot } from "./knowledge";

const e = messages.club.knowledge.errors;
const uuid = z.uuid();
const path = (clubId: string) => `/clubs/${clubId}/knowledge`;

async function client() {
  await requireUser();
  return createClient();
}

/** Prepares a direct upload of a club document: a signed upload URL for <club>/<document>/<file>. */
export async function prepareDocumentUpload(
  clubId: string,
  file: { name: string; type: string; size: number },
): Promise<{ path: string; token: string; documentId: string } | { error: string }> {
  if (!uuid.safeParse(clubId).success || !DOCUMENT_TYPES.includes(file.type) || file.size <= 0 || file.size > DOCUMENT_MAX_BYTES) {
    return { error: e.file };
  }
  const supabase = await client();
  const documentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "document";
  const objectPath = `${clubId}/${documentId}/${safeName}`;
  const { data, error } = await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).createSignedUploadUrl(objectPath);
  if (error || !data) {
    console.error("prepareDocumentUpload failed", error);
    return { error: e.failed };
  }
  return { path: objectPath, token: data.token, documentId };
}

const documentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["guideline", "agreement", "document"]),
  description: z
    .string()
    .trim()
    .max(600)
    .transform((v) => v || null),
  age_categories: z.array(z.enum(AGE_CATEGORIES)),
});

/** Stores an uploaded document (owner, admin or technical director; checked by RLS). */
export async function saveDocument(
  clubId: string,
  upload: { path: string; documentId: string; fileName: string; size: number },
  fields: { title: string; kind: string; description: string; categories: string[] },
): Promise<FormState> {
  const parsed = documentSchema.safeParse({ ...fields, age_categories: fields.categories });
  if (!parsed.success || !upload.path.startsWith(`${clubId}/${upload.documentId}/`)) return { error: e.invalid };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("club_documents").insert({
    id: upload.documentId,
    club_id: clubId,
    file_path: upload.path,
    file_name: upload.fileName.slice(0, 200),
    size_bytes: upload.size,
    uploaded_by: user.id,
    ...parsed.data,
  });
  if (error) {
    console.error("saveDocument failed", error);
    await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).remove([upload.path]);
    return { error: e.failed };
  }
  revalidatePath(path(clubId));
  return { ok: "" };
}

export async function deleteDocument(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { data: doc } = await supabase
    .from("club_documents")
    .delete()
    .eq("id", String(formData.get("documentId")))
    .select("file_path")
    .maybeSingle();
  if (doc) await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).remove([doc.file_path]);
  revalidatePath(path(clubId));
}

/**
 * A head coach shares a training day of the approved week document of his
 * club team with the club (a snapshot of the Assistant Coach's day).
 */
export async function shareTraining(teamId: string, runId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 600);
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(runId).success || !z.iso.date().safeParse(date).success) {
    return { error: e.invalid };
  }
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: team }, { data: run }, { data: proposal }] = await Promise.all([
    supabase.from("teams").select("club_id, age_category").eq("id", teamId).maybeSingle(),
    supabase.from("staff_runs").select("status").eq("id", runId).eq("team_id", teamId).maybeSingle(),
    supabase.from("staff_proposals").select("output").eq("run_id", runId).eq("step", "ac").maybeSingle(),
  ]);
  if (!team?.club_id || run?.status !== "approved") return { error: e.notApproved };
  const day = trainingDaySnapshot(proposal?.output, date);
  if (!day) return { error: e.notApproved };
  const { error } = await supabase.from("club_shared_trainings").insert({
    club_id: team.club_id,
    team_id: teamId,
    session_date: date,
    title: day.titel.slice(0, 120),
    age_category: ageCategory(team.age_category),
    content: day as unknown as Json,
    note: note || null,
    shared_by: user.id,
  });
  if (error) {
    console.error("shareTraining failed", error);
    return { error: e.failed };
  }
  revalidatePath(path(team.club_id));
  return { ok: messages.club.knowledge.share.done };
}

/** Owner, admin or technical director: mark a shared training as an example (or not). */
export async function setExample(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const trainingId = String(formData.get("trainingId"));
  const supabase = await client();
  const { error } = await supabase
    .from("club_shared_trainings")
    .update({ is_example: formData.get("example") === "1" })
    .eq("id", trainingId);
  if (error) console.error("setExample failed", error);
  revalidatePath(path(clubId), "layout");
}

export async function removeSharedTraining(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.from("club_shared_trainings").delete().eq("id", String(formData.get("trainingId")));
  if (error) console.error("removeSharedTraining failed", error);
  revalidatePath(path(clubId), "layout");
  redirect(path(clubId));
}

export async function addComment(clubId: string, trainingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 1000 || !uuid.safeParse(clubId).success || !uuid.safeParse(trainingId).success) return { error: e.invalid };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_training_comments")
    .insert({ club_id: clubId, training_id: trainingId, body, author_id: user.id });
  if (error) {
    console.error("addComment failed", error);
    return { error: e.failed };
  }
  revalidatePath(`${path(clubId)}/${trainingId}`);
  return { ok: "" };
}

export async function deleteComment(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const trainingId = String(formData.get("trainingId"));
  const supabase = await client();
  const { error } = await supabase.from("club_training_comments").delete().eq("id", String(formData.get("commentId")));
  if (error) console.error("deleteComment failed", error);
  revalidatePath(`${path(clubId)}/${trainingId}`);
}
