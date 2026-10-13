"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { testCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/weeks/dates";

export type TestFormState = { error?: string; success?: string };

const e = messages.tests.errors;
const uuid = z.uuid();

/** Saves the results of one test session (one date) for the players that have a value. */
export async function saveTestResults(
  teamId: string,
  testCode: string,
  _prev: TestFormState,
  formData: FormData,
): Promise<TestFormState> {
  const test = testCatalog.testen.find((t) => t.code === testCode);
  if (!test || !uuid.safeParse(teamId).success) return { error: e.saveFailed };
  const date = String(formData.get("date") ?? "");
  if (!isIsoDate(date)) return { error: e.date };

  const rows: { team_id: string; player_id: string; test_code: string; test_date: string; result: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("result:") || typeof value !== "string" || value.trim() === "") continue;
    const playerId = key.slice("result:".length);
    const result = Number(value.replace(",", "."));
    if (!uuid.safeParse(playerId).success) continue;
    if (!Number.isFinite(result) || result < test.min || result > test.max) {
      return { error: e.range(test.min, test.max, test.eenheid) };
    }
    rows.push({ team_id: teamId, player_id: playerId, test_code: test.code, test_date: date, result });
  }
  if (rows.length === 0) return { error: e.empty };

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fitness_tests")
    .upsert(rows, { onConflict: "player_id,test_code,test_date" });
  if (error) {
    console.error("saveTestResults failed", error);
    return { error: e.saveFailed };
  }
  revalidatePath(`/teams/${teamId}`, "layout");
  return { success: messages.tests.saved };
}

export async function deleteTestSession(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const testCode = String(formData.get("testCode"));
  const date = String(formData.get("date"));
  if (!uuid.safeParse(teamId).success || !isIsoDate(date)) return;

  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("fitness_tests")
    .delete()
    .eq("team_id", teamId)
    .eq("test_code", testCode)
    .eq("test_date", date);
  if (error) console.error("deleteTestSession failed", error);
  revalidatePath(`/teams/${teamId}`, "layout");
}
