import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function loadExercise(exerciseId: string) {
  if (!z.uuid().safeParse(exerciseId).success) notFound();
  await requireUser();
  const supabase = await createClient();
  const { data: exercise } = await supabase.from("exercises").select("*").eq("id", exerciseId).maybeSingle();
  if (!exercise) notFound();
  return { exercise, supabase };
}
