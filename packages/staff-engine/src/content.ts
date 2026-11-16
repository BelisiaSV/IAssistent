/**
 * Parsers and helpers for /staff content that do not touch the file system
 * or the AI. Safe to use from the web app (client and server).
 */
export * from "./context";
export * from "./shared/formations";
export * from "./shared/matchdays";
export * from "./shared/periodization";
export * from "./shared/tests";
export * from "./shared/positions";
export * from "./shared/vision";
export type { ParseResult } from "./shared/parse";
export type { Staff, StaffFile, StaffIssue, StaffRole, RoleMeta } from "./types";
export type { ConversationInput, ConversationReply, ConversationTurn, TaskProposal } from "./conversation";
export type { CollaborationInput, CollaborationOutput, CollaborationPhase, CollaborationTask } from "./collaboration";
export * from "./shared/meeting";
export type { MeetingInput, MeetingOutput, MeetingOverview } from "./meeting";
