"use server";

import type { Json } from "@iassistent/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { parseImportRows, toImportPayload } from "@/lib/players/import";
import { readImportFile } from "@/lib/players/template";
import { positionCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

const e = messages.playerImport.errors;
const MAX_BYTES = 2 * 1024 * 1024;

export interface PreviewRow {
  line: number;
  name: string;
  shirtNumber: number | null;
  position: string | null;
  update: boolean;
  errors: string[];
}

export type ImportState =
  | { error?: string; preview?: undefined; done?: undefined }
  | { preview: { teamId: string; rows: PreviewRow[]; errorCount: number }; error?: undefined; done?: undefined }
  | { done: { teamId: string; inserted: number; updated: number }; error?: undefined; preview?: undefined };

/** Reads and checks the uploaded file; nothing is saved. */
async function read(formData: FormData) {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.failed } as const;

  const teamId = String(formData.get("teamId") ?? "");
  if (!z.uuid().safeParse(teamId).success) return { error: e.team } as const;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: e.file } as const;
  }
  const cells = await readImportFile(await file.arrayBuffer());
  if (!cells) return { error: e.unreadable } as const;
  const parsed = parseImportRows(cells, positionCatalog.posities.map((p) => p.code));
  if ("error" in parsed) return { error: parsed.error } as const;
  return { supabase, teamId, rows: parsed.rows } as const;
}

export async function checkImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const result = await read(formData);
  if ("error" in result) return { error: result.error };
  const { data: current } = await result.supabase.rpc("admin_team_players", { p_team_id: result.teamId });
  const numbers = new Set((current ?? []).map((p) => p.shirt_number).filter((n) => n !== null));
  const rows: PreviewRow[] = result.rows.map((r) => ({
    line: r.line,
    name: r.player ? `${r.player.firstName} ${r.player.lastName}` : "",
    shirtNumber: r.player?.shirtNumber ?? null,
    position: r.player?.primaryPosition ?? null,
    update: r.player?.shirtNumber !== null && r.player?.shirtNumber !== undefined && numbers.has(r.player.shirtNumber),
    errors: r.errors,
  }));
  return { preview: { teamId: result.teamId, rows, errorCount: rows.filter((r) => r.errors.length).length } };
}

/** Imports the same file again after the check; refuses as long as a row is wrong. */
export async function runImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const result = await read(formData);
  if ("error" in result) return { error: result.error };
  if (result.rows.some((r) => r.errors.length || !r.player)) return { error: e.failed };

  const { data, error } = await result.supabase.rpc("admin_import_players", {
    p_team_id: result.teamId,
    p_players: result.rows.map((r) => toImportPayload(r.player!)) as unknown as Json,
  });
  if (error || !data) {
    console.error("admin_import_players failed", error);
    return { error: e.failed };
  }
  const counts = data as { inserted: number; updated: number };
  revalidatePath(`/teams/${result.teamId}/players`);
  return { done: { teamId: result.teamId, inserted: counts.inserted, updated: counts.updated } };
}
