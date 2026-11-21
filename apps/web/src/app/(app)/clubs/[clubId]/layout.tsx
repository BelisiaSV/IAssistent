import type { ReactNode } from "react";

import { Alert } from "@/components/ui";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";

import { ClubTabs } from "./club-tabs";

const m = messages.club;

/** Every page of a club: the club's name, the user's role and the tabs. */
export default async function ClubLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold tracking-wider text-sky-600 uppercase">
          {m.environment}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {ctx.club.primary_color && (
            <span
              aria-hidden
              className="h-6 w-6 rounded-full ring-2 ring-white/40"
              style={{ background: ctx.club.primary_color }}
            />
          )}
          <h1 className="text-2xl font-semibold">{ctx.club.name}</h1>
        </div>
        <p className="text-sm text-slate-600">
          {m.yourRoles(
            ctx.roles.map((r) => messages.clubAdmin.roles[r]).join(", "),
          )}
        </p>
      </div>
      {!ctx.active && <Alert tone="error">{m.inactive}</Alert>}
      <ClubTabs
        clubId={clubId}
        manage={ctx.canManage}
        dna={(ctx.subscription?.modules ?? []).includes("dna")}
        exercises={(ctx.subscription?.modules ?? []).includes("exercises")}
      />
      {children}
    </div>
  );
}
