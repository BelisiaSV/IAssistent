import { TEAM_LOGO_MAX_BYTES } from "@iassistent/db";
import { z } from "zod";

import { messages } from "@/lib/messages";

const t = messages.teamForm.errors;
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, t.color);

export const teamInputSchema = z.object({
  name: z.string().trim().min(1, t.nameRequired).max(120, t.tooLong),
  season: z
    .string()
    .trim()
    .max(20, t.tooLong)
    .transform((v) => (v === "" ? null : v)),
  clubName: z.string().trim().min(1, t.clubNameRequired).max(120, t.tooLong),
  primaryColor: hexColor,
  secondaryColor: hexColor,
});

export type TeamInput = z.infer<typeof teamInputSchema>;

export type LogoKind = { mimeType: "image/png" | "image/jpeg" | "image/webp"; extension: string };

/** Detects the image type from the file's first bytes (not from its name or claimed type). */
export function detectLogoKind(bytes: Uint8Array): LogoKind | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (starts([0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", extension: "jpg" };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

export type LogoCheck =
  | { ok: true; kind: LogoKind | null }
  | { ok: false; error: string };

/** Validates an optional logo upload. `kind` is null when no file was chosen. */
export function checkLogo(size: number, firstBytes: Uint8Array): LogoCheck {
  if (size === 0) return { ok: true, kind: null };
  if (size > TEAM_LOGO_MAX_BYTES) return { ok: false, error: t.logoSize };
  const kind = detectLogoKind(firstBytes);
  if (!kind) return { ok: false, error: t.logoType };
  return { ok: true, kind };
}
