"use server";

import { canConverse, runConversation, StaffGenerationError } from "@iassistent/staff-engine";
import { z } from "zod";

import { getStaffProvider } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { startOfTodayInBelgium } from "@/lib/weeks/dates";

import { teamContextForChat } from "./context";
import { HISTORY_MESSAGES, isStaffRoomRole, MESSAGE_MAX } from "./roles";
import { type ChatMessage, MESSAGE_COLUMNS, toChatMessage } from "./types";

const e = messages.staffRoom.errors;
const uuid = z.uuid();

export type ThreadResult = { messages: ChatMessage[]; canWrite: boolean } | { error: string };
export type SendResult = { messages: ChatMessage[]; error?: string };

function validRole(role: string) {
  return isStaffRoomRole(role) && canConverse(staff, role);
}

/** The conversation of the head coach with one role of a team, oldest first. */
export async function loadThread(teamId: string, role: string): Promise<ThreadResult> {
  if (!uuid.safeParse(teamId).success || !validRole(role)) return { error: e.load };
  await requireUser();
  const supabase = await createClient();
  const [{ data, error }, { data: canWrite }] = await Promise.all([
    supabase.from("staff_messages").select(MESSAGE_COLUMNS).eq("team_id", teamId).eq("role", role).order("created_at").limit(200),
    supabase.rpc("can_write_team", { p_team_id: teamId }),
  ]);
  if (error) {
    console.error("loadThread failed", error);
    return { error: e.load };
  }
  return { messages: (data ?? []).map(toChatMessage), canWrite: !!canWrite };
}

/**
 * Sends a question of the head coach to a role and stores its answer. The
 * role gets the approved team context and the earlier messages of this
 * conversation. In test mode the answer comes from /staff/<rol>/taken/gesprek.
 */
export async function sendMessage(teamId: string, role: string, text: string): Promise<SendResult> {
  const question = text.trim();
  if (!uuid.safeParse(teamId).success || !validRole(role)) return { messages: [], error: e.send };
  if (!question) return { messages: [], error: e.empty };
  if (question.length > MESSAGE_MAX) return { messages: [], error: e.tooLong(MESSAGE_MAX) };

  const user = await requireUser();
  const supabase = await createClient();
  const { data: team } = await supabase.from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return { messages: [], error: e.send };

  const { data: earlier } = await supabase
    .from("staff_messages")
    .select("author, content")
    .eq("team_id", teamId)
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);

  const { data: asked, error: askError } = await supabase
    .from("staff_messages")
    .insert({ team_id: teamId, role, author: "coach", content: question })
    .select(MESSAGE_COLUMNS)
    .single();
  if (askError || !asked) {
    if (askError?.code !== "42501") console.error("sendMessage: question not stored", askError);
    return { messages: [], error: askError?.code === "42501" ? e.readOnly : e.send };
  }
  const sent = [toChatMessage(asked)];

  try {
    const provider = getStaffProvider();
    // Real AI: stop before the call when the daily limit is reached (the database checks it again).
    if (provider.id !== "example") {
      const { data: limit } = await supabase.rpc("staff_chat_daily_limit");
      const { count } = await supabase
        .from("staff_messages")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("author", "role")
        .neq("provider", "example")
        .gte("created_at", startOfTodayInBelgium());
      if (limit && (count ?? 0) >= limit) return { messages: sent, error: e.dailyLimit };
    }
    const result = await runConversation(
      staff,
      role,
      {
        teamcontext: await teamContextForChat(supabase, team, user.id),
        gesprek: (earlier ?? []).toReversed().map((m) => ({ van: m.author === "coach" ? "hoofdcoach" : "rol", tekst: m.content })),
        vraag: question,
      },
      provider,
    );
    const { data: answer, error } = await supabase
      .from("staff_messages")
      .insert({
        team_id: teamId,
        role,
        author: "role",
        content: result.reply.antwoord,
        task_proposal: result.reply.taakvoorstel ? { ...result.reply.taakvoorstel } : null,
        provider: result.provider,
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error || !answer) {
      if (error?.hint === "daily_limit_reached") return { messages: sent, error: e.dailyLimit };
      console.error("sendMessage: answer not stored", error);
      return { messages: sent, error: e.answer };
    }
    return { messages: [...sent, toChatMessage(answer)] };
  } catch (err) {
    console.error("sendMessage: role did not answer", err instanceof StaffGenerationError ? err.code : err);
    return { messages: sent, error: e.answer };
  }
}
