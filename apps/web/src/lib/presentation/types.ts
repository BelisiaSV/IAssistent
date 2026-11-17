import type { Drawing } from "@/lib/proposals/types";
import type { Outcome } from "@/lib/teams/dashboard";

/** A player on a slide pitch: slot position in % (x from left, y from the own goal at 100). */
export interface SlidePlayer {
  x: number;
  y: number;
  number: number | null;
  /** Main line under the shirt (surname, or the name as entered for an opponent). */
  name: string;
  /** Second, smaller line (first name). */
  detail: string | null;
  goalkeeper: boolean;
}

export interface SlideLineup {
  formation: string;
  players: SlidePlayer[];
}

/** Everything the slides of the match presentation show. */
export interface PresentationData {
  team: {
    id: string;
    name: string;
    clubName: string;
    primary: string;
    secondary: string;
    logoUrl: string | null;
  };
  match: {
    date: string;
    start: string | null;
    home: boolean;
    opponent: string;
  } | null;
  /** Upcoming matches the coach can choose from. */
  matches: { date: string; opponent: string }[];
  /** Shirt colours are null when the coach did not set them. */
  opponent: {
    name: string;
    logoUrl: string | null;
    shirt: string | null;
    trim: string | null;
  } | null;
  stats: {
    position: number | null;
    record: { win: number; draw: number; loss: number };
    points: number;
    matches: number;
    last: { outcome: Outcome; opponent: string; logoUrl: string | null }[];
  } | null;
  opponentLineup: SlideLineup | null;
  ownLineup: SlideLineup | null;
  principle: {
    title: string;
    explanation: string;
    drawing: Drawing | null;
  } | null;
  /** The week of the match, to rewrite the principle (null without a week). */
  principleEdit: {
    weekPlanId: string;
    /** The head coach rewrote the principle. */
    custom: boolean;
    /** The principle of the Tactical Coach, if any. */
    original: { title: string; explanation: string } | null;
  } | null;
  canEdit: boolean;
}
