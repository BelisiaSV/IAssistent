"use server";

import type { Json } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { bankToExercise } from "@/lib/exercise-bank/copy";
import { recordFromForm } from "@/lib/exercise-bank/form";
import { parseBank } from "@/lib/exercise-bank/import";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";

import { CLUB_EXERCISE_COLUMNS, type ClubExerciseRow } from "./exercises";
import type { FormState } from "./form-state";

const e = messages.club.exercises.errors;
const fieldNames = messages.exerciseBank.fields as Record<string, string>;
const uuid = z.uuid();

async function client() {
  await requireUser();
  return createClient();
}

/** Where a new club exercise comes from (fixed when it is made). */
export interface ClubExerciseOrigin {
  origin: "club" | "bank_variant" | "coach_share";
  baseBankNumber?: string | null;
  sourceExerciseId?: string | null;
}

/**
 * Creates (exerciseId null) or changes a club exercise from the exercise form.
 * The fields are checked with the rules of the exercise bank; the database
 * checks who may do what.
 */
export async function saveClubExercise(
  clubId: string,
  exerciseId: string | null,
  origin: ClubExerciseOrigin,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (
    !uuid.safeParse(clubId).success ||
    (exerciseId && !uuid.safeParse(exerciseId).success)
  )
    return { error: e.failed };
  const parsed = parseBank([{ ...recordFromForm(formData), nummer: "CLUB-1" }]);
  const exercise = parsed?.exercises[0];
  if (!exercise) {
    const field = parsed?.issues[0]?.field ?? "";
    return { error: e.invalid(fieldNames[field] ?? field) };
  }
  const ages = formData
    .getAll("ages")
    .map(String)
    .filter((a) => (AGE_CATEGORIES as readonly string[]).includes(a));
  const level = String(formData.get("level") ?? "")
    .trim()
    .slice(0, 60);
  const supabase = await client();
  const { data, error } = await supabase.rpc("save_club_exercise", {
    p_club_id: clubId,
    p_id: exerciseId,
    p_data: {
      title: exercise.title,
      kind: exercise.kind,
      phase: exercise.phase,
      target_group: exercise.target_group,
      tags: exercise.tags,
      principles: exercise.principles,
      content: JSON.parse(JSON.stringify(exercise.content)),
      age_categories: ages,
      level,
      origin: origin.origin,
      base_bank_number: origin.baseBankNumber ?? null,
      source_exercise_id: origin.sourceExerciseId ?? null,
    } as Json,
  });
  if (error || !data) {
    console.error("saveClubExercise failed", error);
    return { error: error?.hint === "module_inactive" ? e.module : e.failed };
  }
  revalidatePath(`/clubs/${clubId}/exercises`, "layout");
  if (!exerciseId) redirect(`/clubs/${clubId}/exercises/${data}`);
  return { ok: messages.club.exercises.saved };
}

/** Owner, admin or technical director: approve, archive or send back. */
export async function setClubExerciseStatus(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("set_club_exercise_status", {
    p_id: String(formData.get("exerciseId")),
    p_status: String(formData.get("status")),
  });
  if (error) console.error("setClubExerciseStatus failed", error);
  revalidatePath(`/clubs/${clubId}/exercises`, "layout");
}

export async function setClubExerciseRecommended(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const supabase = await client();
  const { error } = await supabase.rpc("set_club_exercise_recommended", {
    p_id: String(formData.get("exerciseId")),
    p_recommended: formData.get("recommended") === "1",
  });
  if (error) console.error("setClubExerciseRecommended failed", error);
  revalidatePath(`/clubs/${clubId}/exercises`, "layout");
}

/** Owner, admin or technical director: a bank exercise as club favourite (optionally recommended), or not. */
export async function setClubBankPick(formData: FormData) {
  const clubId = String(formData.get("clubId"));
  const number = String(formData.get("number"));
  const supabase = await client();
  const { error } = await supabase.rpc("set_club_bank_pick", {
    p_club_id: clubId,
    p_bank_number: number,
    p_pick: formData.get("pick") === "1",
    p_recommended: formData.get("recommended") === "1",
  });
  if (error) console.error("setClubBankPick failed", error);
  revalidatePath(`/exercises/bank/${number}`);
  revalidatePath(`/clubs/${clubId}/exercises`);
}

/** A club exercise as an exercise of the coach's own library (once per coach). */
export async function takeOverClubExercise(formData: FormData) {
  const id = String(formData.get("exerciseId"));
  if (!uuid.safeParse(id).success) return;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("club_exercises")
    .select(CLUB_EXERCISE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  const { data: existing } = await supabase
    .from("exercises")
    .select("id")
    .eq("bank_number", row.number)
    .maybeSingle();
  if (existing) redirect(`/exercises/${existing.id}`);
  const { data: created, error } = await supabase
    .from("exercises")
    .insert({ ...bankToExercise(row as ClubExerciseRow), coach_id: user.id })
    .select("id")
    .single();
  if (error || !created) {
    console.error("takeOverClubExercise failed", error);
    return;
  }
  revalidatePath("/exercises");
  redirect(`/exercises/${created.id}`);
}

/** A coach proposes an exercise of his own library to a club. */
export async function shareExerciseWithClub(formData: FormData) {
  const exerciseId = String(formData.get("exerciseId"));
  const clubId = String(formData.get("clubId"));
  if (!uuid.safeParse(exerciseId).success || !uuid.safeParse(clubId).success)
    return;
  const supabase = await client();
  const { data: ex } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .maybeSingle();
  if (!ex) return;
  const players =
    ex.min_players || ex.max_players
      ? [ex.min_players, ex.max_players].filter(Boolean).join("–")
      : "";
  const parsed = parseBank([
    {
      nummer: "CLUB-1",
      titel: ex.title,
      type: messages.exerciseBank.coach.ownExerciseKind,
      spelfase: "",
      doelgroep: "",
      hoofddoel: "",
      subdoelen: [],
      principes: [],
      aantal_spelers: players,
      duur: ex.duration_min ? `${ex.duration_min} min` : "",
      veldafmeting: "",
      belasting: "",
      belasting_toelichting: "",
      organisatie: ex.organisation
        ? ex.organisation.split("\n").filter(Boolean)
        : [],
      verloop: ex.course,
      regels: "",
      coachingspunten: ex.coaching_points,
      makkelijker: "",
      moeilijker: ex.variations.join("\n"),
      materiaal: [],
      tags: ex.labels,
      zones: [],
    },
  ]);
  const exercise = parsed?.exercises[0];
  if (!exercise) return;
  const { data, error } = await supabase.rpc("save_club_exercise", {
    p_club_id: clubId,
    p_id: null,
    p_data: {
      title: exercise.title,
      kind: exercise.kind,
      tags: exercise.tags,
      principles: [],
      content: JSON.parse(JSON.stringify(exercise.content)),
      age_categories: [],
      origin: "coach_share",
      source_exercise_id: exerciseId,
    } as Json,
  });
  if (error || !data) {
    console.error("shareExerciseWithClub failed", error);
    return;
  }
  revalidatePath(`/clubs/${clubId}/exercises`, "layout");
  redirect(`/clubs/${clubId}/exercises/${data}`);
}
