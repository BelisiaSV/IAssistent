/**
 * Parsers for structured /staff content that do not touch the file system.
 * Safe to use from the web app, which imports the JSON files at build time.
 */
export * from "./shared/formations";
export * from "./shared/positions";
export * from "./shared/vision";
export type { ParseResult } from "./shared/parse";
export type { StaffIssue } from "./types";
