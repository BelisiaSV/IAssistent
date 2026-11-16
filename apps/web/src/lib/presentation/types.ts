import type { Drawing } from "@/lib/proposals/types";
import type { Outcome } from "@/lib/teams/dashboard";

/** A player on a slide pitch: slot position in % (x from left, y from the own goal at 100). */
export interface SlidePlayer {
  x: number;
  y: number;
  number: number | null;
  name: string;
}

export interface SlideLineup {
  formation: string;
  players: SlidePlayer[];
  bench: { number: number | null; name: string }[];
}

/** Everything the seven slides of the match presentation show. */
export interface PresentationData {
  team: { id: string; name: string; clubName: string; primary: string; secondary: string; logoUrl: string | null; coverUrl: string | null; photoUrl: string | null };
  match: { date: string; start: string | null; home: boolean; opponent: string } | null;
  /** Upcoming matches the coach can choose from. */
  matches: { date: string; opponent: string }[];
  opponent: { name: string; logoUrl: string | null } | null;
  stats: {
    position: number | null;
    record: { win: number; draw: number; loss: number };
    points: number;
    matches: number;
    last: { outcome: Outcome; opponent: string; logoUrl: string | null }[];
  } | null;
  opponentLineup: SlideLineup | null;
  ownLineups: SlideLineup[];
  principle: { title: string; explanation: string; drawing: Drawing | null } | null;
  canEdit: boolean;
}
