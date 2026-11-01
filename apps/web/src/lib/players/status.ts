import type { PlayerStatus } from "./validation";

/** Colour per player status (dots, counts); always shown with the status name. */
export const STATUS_COLORS: Record<PlayerStatus, string> = {
  available: "#16a34a",
  injured: "#dc2626",
  suspended: "#d97706",
  unavailable: "#94a3b8",
};
