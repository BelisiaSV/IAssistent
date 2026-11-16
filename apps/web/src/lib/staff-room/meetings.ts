import type { MeetingOutput, MeetingOverview, MeetingTurnKind } from "@iassistent/staff-engine/content";

import type { StepStatus, TaskStatus } from "./tasks";

/** A turn in the staff meeting as the app shows it. */
export interface TurnView {
  id: string;
  version: number;
  position: number;
  role: string;
  kind: MeetingTurnKind;
  status: StepStatus;
  message: string | null;
  to: string | null;
  overview: MeetingOverview | null;
  provider: string;
}

/** A staff meeting with all its turns (every version) in order. */
export interface MeetingView {
  id: string;
  teamId: string;
  assignment: string;
  status: TaskStatus;
  version: number;
  /** What the head coach asked to change: feedbacks[i] led to version i + 2. */
  feedbacks: string[];
  createdAt: string;
  decidedAt: string | null;
  turns: TurnView[];
}

/** A stored turn output, or null when it is missing or malformed. */
export function turnOutput(raw: unknown): MeetingOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.bericht !== "string") return null;
  const ov = o.overzicht as Record<string, unknown> | null | undefined;
  const overview =
    ov && typeof ov === "object" && typeof ov.titel === "string" && typeof ov.samenvatting === "string" && Array.isArray(ov.onderdelen)
      ? {
          titel: ov.titel,
          samenvatting: ov.samenvatting,
          onderdelen: (ov.onderdelen as Record<string, unknown>[])
            .filter((p) => p && typeof p.titel === "string" && typeof p.inhoud === "string")
            .map((p) => ({ titel: p.titel as string, inhoud: p.inhoud as string, rol: typeof p.rol === "string" ? p.rol : null })),
          aandachtspunten: Array.isArray(ov.aandachtspunten) ? ov.aandachtspunten.filter((x): x is string => typeof x === "string") : [],
        }
      : null;
  return { bericht: o.bericht, aan: typeof o.aan === "string" ? o.aan : null, overzicht: overview };
}

type MeetingRow = {
  id: string;
  team_id: string;
  assignment: string;
  status: TaskStatus;
  version: number;
  feedbacks: string[];
  created_at: string;
  decided_at: string | null;
};
type TurnRow = {
  id: string;
  version: number;
  position: number;
  role: string;
  kind: MeetingTurnKind;
  status: StepStatus;
  output: unknown;
  provider: string;
};

export function toMeetingView(meeting: MeetingRow, turns: readonly TurnRow[]): MeetingView {
  return {
    id: meeting.id,
    teamId: meeting.team_id,
    assignment: meeting.assignment,
    status: meeting.status,
    version: meeting.version,
    feedbacks: meeting.feedbacks,
    createdAt: meeting.created_at,
    decidedAt: meeting.decided_at,
    turns: turns
      .toSorted((a, b) => a.version - b.version || a.position - b.position)
      .map((t) => {
        const output = turnOutput(t.output);
        return {
          id: t.id,
          version: t.version,
          position: t.position,
          role: t.role,
          kind: t.kind,
          status: t.status,
          message: output?.bericht ?? null,
          to: output?.aan ?? null,
          overview: output?.overzicht ?? null,
          provider: t.provider,
        };
      }),
  };
}

/** The overview of the current version, once it is ready. */
export function currentOverview(meeting: MeetingView): MeetingOverview | null {
  return meeting.turns.find((t) => t.version === meeting.version && t.kind === "overzicht" && t.status === "ready")?.overview ?? null;
}

/**
 * The conversation so far, as the next speaker gets it: every ready turn of
 * every version, with what the head coach asked between the versions.
 */
export function meetingConversation(meeting: Pick<MeetingView, "assignment" | "feedbacks" | "turns">, beforeVersion: number, beforePosition: number) {
  const out: { van: string; bericht: string; aan: string | null }[] = [];
  for (let version = 1; version <= beforeVersion; version += 1) {
    if (version > 1 && meeting.feedbacks[version - 2]) out.push({ van: "hoofdcoach", bericht: meeting.feedbacks[version - 2]!, aan: null });
    for (const turn of meeting.turns) {
      if (turn.version !== version || turn.status !== "ready" || !turn.message) continue;
      if (version === beforeVersion && turn.position >= beforePosition) continue;
      out.push({ van: turn.role, bericht: turn.message, aan: turn.to });
    }
  }
  return out;
}

/** The roles in the turns of a version, in the order they first speak (for the light flow). */
export function speakingOrder(turns: readonly { role: string; version: number }[], version: number) {
  return [...new Set(turns.filter((t) => t.version === version).map((t) => t.role))];
}

export const MEETING_COLUMNS = "id, team_id, assignment, status, version, feedbacks, created_at, decided_at";
export const TURN_COLUMNS = "id, version, position, role, kind, status, output, provider, updated_at";
