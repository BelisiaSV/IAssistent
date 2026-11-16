"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import type { MatchRow, RefereeRow, StandingRow } from "@/lib/competition/parse";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const e = messages.competition.admin.errors;
const division = z.string().trim().min(1).max(20);
const date = z.iso.date();
const name = z.string().trim().min(1).max(120);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();
const opt = (max: number) => z.string().max(max).nullable();
const goals = z.number().int().min(0).max(99).nullable();
const count = z.number().int().min(0).max(999);

// The rows are read in the browser: check them again here.
const importSchema = z.object({
  divisions: z.array(division).min(1).max(200),
  matches: z
    .array(
      z.object({
        division, date, kickoff: time, home: name, away: name, home_goals: goals, away_goals: goals,
        status: opt(10), matchday: z.number().int().min(0).max(999).nullable(), home_club: opt(10), away_club: opt(10),
      }),
    )
    .max(20000),
  standings: z
    .array(
      z.object({
        division, period: z.number().int().min(0).max(20), position: z.number().int().min(0).max(999), team: name,
        played: count, won: count, lost: count, drawn: count, goals_for: count, goals_against: count, points: z.number().int().min(-999).max(999),
      }),
    )
    .max(5000),
  referees: z
    .array(
      z.object({
        division, date, kickoff: time, home: name, away: name, referee: opt(120), assistant_1: opt(120), assistant_2: opt(120),
        fourth_official: opt(120), match_type: opt(10),
      }),
    )
    .max(5000),
});

export type LinkResult = { ok?: true; error?: string };
export type ImportResult = { counts?: { matches: number; standings: number; referees: number; weeks: number; reports: number }; error?: string };

/** Links a team to its team name and divisions in the export. */
export async function linkTeam(teamId: string, federationTeam: string, divisions: string[]): Promise<LinkResult> {
  const parsed = z
    .object({ teamId: z.uuid(), name: z.string().trim().max(120), divisions: z.array(division).max(10) })
    .safeParse({ teamId, name: federationTeam, divisions });
  if (!parsed.success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.save };
  const { error } = await supabase.rpc("admin_set_team_competition", {
    p_team: parsed.data.teamId,
    p_federation_team: parsed.data.name,
    p_divisions: [...new Set(parsed.data.divisions)],
  });
  if (error) {
    console.error("linkTeam failed", error);
    return { error: e.save };
  }
  revalidatePath("/admin/competition");
  return { ok: true };
}

/** Imports the rows of the linked divisions (already filtered in the browser). */
export async function importCompetition(input: {
  divisions: string[];
  matches: MatchRow[];
  standings: StandingRow[];
  referees: RefereeRow[];
}): Promise<ImportResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: e.import };
  const data = parsed.data;
  if (data.matches.length + data.standings.length + data.referees.length === 0) return { error: e.noFiles };
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return { error: e.import };
  const { data: counts, error } = await supabase.rpc("admin_import_competition", {
    p_divisions: data.divisions,
    p_matches: data.matches,
    p_standings: data.standings,
    p_referees: data.referees,
  });
  if (error || !counts) {
    console.error("importCompetition failed", error);
    return { error: e.import };
  }
  revalidatePath("/", "layout");
  return { counts: counts as ImportResult["counts"] };
}
