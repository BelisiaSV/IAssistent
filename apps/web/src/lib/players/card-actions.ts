"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, mondayOf } from "@/lib/weeks/dates";

import type { Card } from "./cards";

const e = messages.cards.errors;
const uuid = z.uuid();

export type CardResult = { card?: { id: string; playerId: string; card: Card }; error?: string };

function refresh(teamId: string, matchDate: string) {
  revalidatePath(`/teams/${teamId}/weeks/${mondayOf(matchDate)}`);
  revalidatePath(`/teams/${teamId}/evaluations`);
}

/** Records a yellow or red card of a player in a match. */
export async function addCard(teamId: string, playerId: string, matchDate: string, card: Card): Promise<CardResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(playerId).success || !isIsoDate(matchDate) || !["yellow", "red"].includes(card)) {
    return { error: e.save };
  }
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_cards")
    .insert({ team_id: teamId, player_id: playerId, match_date: matchDate, card })
    .select("id, player_id, card")
    .single();
  if (error || !data) {
    if (error?.code !== "42501") console.error("addCard failed", error);
    return { error: e.save };
  }
  refresh(teamId, matchDate);
  return { card: { id: data.id, playerId: data.player_id, card: data.card } };
}

/** Removes a card that was recorded by mistake. */
export async function removeCard(teamId: string, cardId: string, matchDate: string): Promise<CardResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(cardId).success || !isIsoDate(matchDate)) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("player_cards").delete().eq("id", cardId).eq("team_id", teamId);
  if (error) {
    console.error("removeCard failed", error);
    return { error: e.save };
  }
  refresh(teamId, matchDate);
  return {};
}
