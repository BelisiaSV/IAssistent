"use client";

import { useEffect, useState } from "react";

import { advanceMeeting } from "@/lib/staff-room/meeting-actions";
import type { MeetingView } from "@/lib/staff-room/meetings";

/** A role "types" at least this long, so the meeting reads like a conversation. */
const TYPING_MS = 1300;
/** Wait before asking again when another page is running the current turn. */
const WAIT_MS = 2000;

const signature = (m: MeetingView) => m.turns.map((t) => t.status).join(",");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps a staff meeting going while it runs: lets the next role speak until
 * the overview is ready (or a turn failed). The server never runs a turn twice.
 */
export function useMeetingRunner(initial: MeetingView | null) {
  const [meeting, setMeeting] = useState<MeetingView | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const id = meeting?.id ?? null;
  const running = meeting?.status === "running";

  useEffect(() => {
    if (!id || !running) return;
    let cancelled = false;
    (async () => {
      let last = "";
      while (!cancelled) {
        const started = Date.now();
        const result = await advanceMeeting(id);
        if (cancelled) return;
        if (!result.meeting) {
          setError(result.error);
          return;
        }
        const now = signature(result.meeting);
        if (now === last) await sleep(WAIT_MS);
        else await sleep(Math.max(0, TYPING_MS - (Date.now() - started)));
        if (cancelled) return;
        last = now;
        setMeeting(result.meeting);
        if (result.meeting.status !== "running") return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, running]);

  return { meeting, setMeeting, error, setError };
}
