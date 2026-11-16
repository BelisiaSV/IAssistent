"use server";

import type { Json } from "@iassistent/db";
import { meetingTurns, runMeetingTurn, StaffGenerationError } from "@iassistent/staff-engine";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffProvider } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { staff } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";

import { teamContextForChat } from "./context";
import { currentOverview, MEETING_COLUMNS, meetingConversation, type MeetingView, toMeetingView, TURN_COLUMNS } from "./meetings";
import { MESSAGE_MAX } from "./roles";
import { nextStep, statusFromSteps } from "./tasks";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type MeetingResult = { meeting: MeetingView; error?: string } | { meeting?: undefined; error: string };

const e = messages.staffRoom.meeting.errors;
const uuid = z.uuid();
/** A turn still generating this long after it started is considered lost. */
const STALE_MS = 20 * 60 * 1000;

async function loadMeeting(supabase: Supabase, meetingId: string): Promise<MeetingView | null> {
  const [{ data: meeting }, { data: turns }] = await Promise.all([
    supabase.from("staff_meetings").select(MEETING_COLUMNS).eq("id", meetingId).maybeSingle(),
    supabase.from("staff_meeting_turns").select(TURN_COLUMNS).eq("meeting_id", meetingId),
  ]);
  return meeting ? toMeetingView(meeting, turns ?? []) : null;
}

/** Inserts the turns of a version (all pending), in the order of _gedeeld/staffkamer.json. */
async function insertTurns(supabase: Supabase, meeting: { id: string; team_id: string }, version: number) {
  const provider = getStaffProvider();
  return (
    await supabase.from("staff_meeting_turns").insert(
      meetingTurns(staff).map((turn) => ({
        meeting_id: meeting.id,
        team_id: meeting.team_id,
        version,
        position: turn.position,
        role: turn.role,
        kind: turn.kind,
        provider: provider.id,
      })),
    )
  ).error;
}

function validText(text: string): { value: string; error?: undefined } | { value?: undefined; error: string } {
  const value = text.trim();
  if (!value) return { error: e.empty };
  if (value.length > MESSAGE_MAX) return { error: e.tooLong(MESSAGE_MAX) };
  return { value };
}

/** The head coach gives the staff one assignment; the roles start talking. */
export async function startMeeting(teamId: string, assignment: string): Promise<MeetingResult> {
  const text = validText(assignment);
  if (!uuid.safeParse(teamId).success) return { error: e.start };
  if (text.error !== undefined) return { error: text.error };
  await requireUser();
  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("staff_meetings")
    .insert({ team_id: teamId, assignment: text.value! })
    .select("id, team_id")
    .single();
  if (error || !meeting) {
    if (error?.code !== "42501") console.error("startMeeting failed", error);
    return { error: error?.code === "42501" ? e.readOnly : e.start };
  }
  const turnsError = await insertTurns(supabase, meeting, 1);
  if (turnsError) {
    await supabase.from("staff_meetings").update({ status: "failed" }).eq("id", meeting.id);
    if (turnsError.hint !== "daily_limit_reached") console.error("startMeeting: turns failed", turnsError);
  }
  revalidatePath(`/teams/${teamId}/staff-room`);
  const view = (await loadMeeting(supabase, meeting.id))!;
  return turnsError ? { meeting: view, error: turnsError.hint === "daily_limit_reached" ? e.dailyLimit : e.start } : { meeting: view };
}

/**
 * Lets the next role speak (one turn per call, so each AI call gets its own
 * request). A turn is claimed with a conditional update, so concurrent calls
 * never run it twice.
 */
export async function advanceMeeting(meetingId: string): Promise<MeetingResult> {
  if (!uuid.safeParse(meetingId).success) return { error: e.load };
  const user = await requireUser();
  const supabase = await createClient();
  const view = await loadMeeting(supabase, meetingId);
  if (!view) return { error: e.load };
  if (view.status !== "running") return { meeting: view };

  const { data: rows } = await supabase.from("staff_meeting_turns").select(TURN_COLUMNS).eq("meeting_id", meetingId).eq("version", view.version);
  let turns = rows ?? [];
  const stale = turns.filter((t) => t.status === "generating" && Date.now() - new Date(t.updated_at).getTime() > STALE_MS);
  if (stale.length) {
    await supabase.from("staff_meeting_turns").update({ status: "failed" }).in("id", stale.map((t) => t.id));
    turns = turns.map((t) => (stale.includes(t) ? { ...t, status: "failed" as const } : t));
  }

  const turn = nextStep(turns);
  if (turn) {
    const { data: claimed } = await supabase
      .from("staff_meeting_turns")
      .update({ status: "generating" })
      .eq("id", turn.id)
      .eq("status", "pending")
      .select("id");
    if (claimed?.length) {
      let status: "ready" | "failed" = "failed";
      try {
        const { data: team } = await supabase.from("teams").select("*").eq("id", view.teamId).single();
        if (!team) throw new Error("team not found");
        const previous = view.version > 1 ? view.turns.find((t) => t.version === view.version - 1 && t.kind === "overzicht")?.overview : null;
        const feedback = view.feedbacks[view.version - 2];
        const result = await runMeetingTurn(
          staff,
          turn.role,
          {
            teamcontext: await teamContextForChat(supabase, team, user.id),
            opdracht: view.assignment,
            soort: turn.kind,
            gesprek: meetingConversation(view, view.version, turn.position),
            feedback: previous && feedback ? { vorig_overzicht: previous, feedback } : null,
          },
          getStaffProvider(),
        );
        await supabase
          .from("staff_meeting_turns")
          .update({ status: "ready", output: JSON.parse(JSON.stringify(result.output)) as Json, provider: result.provider })
          .eq("id", turn.id);
        status = "ready";
      } catch (err) {
        console.error("advanceMeeting: turn failed", err instanceof StaffGenerationError ? err.code : err);
        await supabase.from("staff_meeting_turns").update({ status: "failed" }).eq("id", turn.id);
      }
      turns = turns.map((t) => (t.id === turn.id ? { ...t, status } : t));
    }
  }

  const status = statusFromSteps(turns);
  if (status !== "running" && !turns.some((t) => t.status === "generating")) {
    await supabase.from("staff_meetings").update({ status }).eq("id", meetingId).eq("status", "running");
    revalidatePath(`/teams/${view.teamId}/staff-room`);
  }
  return { meeting: (await loadMeeting(supabase, meetingId))! };
}

/** The head coach approves the joint overview. */
export async function approveMeeting(meetingId: string): Promise<MeetingResult> {
  if (!uuid.safeParse(meetingId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_meetings")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", meetingId)
    .eq("status", "ready")
    .select("team_id");
  if (error || !data?.length) return { error: e.save };
  revalidatePath(`/teams/${data[0]!.team_id}/staff-room`);
  return { meeting: (await loadMeeting(supabase, meetingId))! };
}

/** The head coach asks for a change: the staff talks again (a new version) with his feedback. */
export async function adjustMeeting(meetingId: string, feedback: string): Promise<MeetingResult> {
  const text = validText(feedback);
  if (!uuid.safeParse(meetingId).success) return { error: e.save };
  if (text.error !== undefined) return { error: text.error };
  await requireUser();
  const supabase = await createClient();
  const view = await loadMeeting(supabase, meetingId);
  if (!view || view.status === "running" || !currentOverview(view)) return { error: e.save };
  const version = view.version + 1;
  const { data, error } = await supabase
    .from("staff_meetings")
    .update({ version, feedbacks: [...view.feedbacks, text.value!], status: "running", decided_at: null })
    .eq("id", meetingId)
    .eq("version", view.version)
    .select("id, team_id");
  if (error || !data?.length) return { error: e.save };
  const turnsError = await insertTurns(supabase, data[0]!, version);
  if (turnsError) {
    await supabase.from("staff_meetings").update({ status: "failed" }).eq("id", meetingId);
    return { meeting: (await loadMeeting(supabase, meetingId))!, error: turnsError.hint === "daily_limit_reached" ? e.dailyLimit : e.save };
  }
  return { meeting: (await loadMeeting(supabase, meetingId))! };
}

/** Lets the roles whose turn failed speak again. */
export async function retryMeeting(meetingId: string): Promise<MeetingResult> {
  if (!uuid.safeParse(meetingId).success) return { error: e.save };
  await requireUser();
  const supabase = await createClient();
  const { data: meeting } = await supabase.from("staff_meetings").select("id, team_id, version, status").eq("id", meetingId).maybeSingle();
  if (!meeting || meeting.status !== "failed") return { error: e.save };
  const { data: turns } = await supabase.from("staff_meeting_turns").select("id").eq("meeting_id", meetingId).eq("version", meeting.version);
  if (!turns?.length) {
    const turnsError = await insertTurns(supabase, meeting, meeting.version);
    if (turnsError) return { error: turnsError.hint === "daily_limit_reached" ? e.dailyLimit : e.save };
  } else {
    await supabase.from("staff_meeting_turns").update({ status: "pending" }).eq("meeting_id", meetingId).eq("version", meeting.version).eq("status", "failed");
  }
  await supabase.from("staff_meetings").update({ status: "running" }).eq("id", meetingId).eq("status", "failed");
  return { meeting: (await loadMeeting(supabase, meetingId))! };
}
