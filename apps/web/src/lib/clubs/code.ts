import "server-only";

import { CLUB_ROLES, TEAM_STAFF_ROLES } from "@iassistent/db";
import { z } from "zod";

import { messages } from "@/lib/messages";
import type { createClient } from "@/lib/supabase/server";

import type { CodeState } from "./form-state";
import { teamRoleFits } from "./import";

const c = messages.clubAdmin.codes;

/**
 * Makes one activation code from the code form. Who may make which code is
 * checked by the database (create_club_activation_code).
 */
export async function createCodeFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  formData: FormData,
): Promise<CodeState> {
  const parsed = z
    .object({
      clubId: z.uuid(),
      role: z.enum(CLUB_ROLES),
      teamId: z.union([z.literal(""), z.uuid()]),
      teamRole: z.union([z.literal(""), z.enum(TEAM_STAFF_ROLES)]),
      expires: z.union([z.literal(""), z.iso.date()]),
      note: z.string().trim().max(120),
    })
    .safeParse({
      clubId,
      role: formData.get("role"),
      teamId: formData.get("teamId") ?? "",
      teamRole: formData.get("teamRole") ?? "",
      expires: formData.get("expires") ?? "",
      note: formData.get("note") ?? "",
    });
  if (!parsed.success) return { error: c.errors.failed };
  const d = parsed.data;
  if (d.teamId && (!d.teamRole || !teamRoleFits(d.role, d.teamRole)))
    return { error: c.errors.teamRole };
  const { data, error } = await supabase.rpc("create_club_activation_code", {
    p_club_id: clubId,
    p_role: d.role,
    // End of the chosen day.
    p_expires_at: d.expires ? `${d.expires}T23:59:59` : null,
    p_team_id: d.teamId || null,
    p_team_role: d.teamId ? d.teamRole || null : null,
    p_note: d.note || null,
  });
  const code = data?.[0]?.code;
  if (error || !code) {
    console.error("create_club_activation_code failed", error);
    if (error?.hint === "license_seats_exhausted")
      return { error: c.errors.noSeats };
    if (error?.hint === "club_inactive") return { error: c.errors.inactive };
    return { error: c.errors.failed };
  }
  return { code };
}
