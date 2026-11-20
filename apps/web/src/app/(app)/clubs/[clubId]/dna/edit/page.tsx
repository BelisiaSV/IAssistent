import { readClubDna } from "@iassistent/staff-engine/content";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/clubs/forms";
import { Alert } from "@/components/ui";
import { discardDnaDraft } from "@/lib/clubs/dna-actions";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { clubDnaQuestionnaire, formationCatalog } from "@/lib/staff";

import { DnaForm } from "./dna-form";

const m = messages.club.dna;

/** Owner, admin and technical director: edit the draft (from the published version when there is no draft). */
export default async function ClubDnaEditPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  if (
    !ctx.roles.some(
      (r) => r === "owner" || r === "admin" || r === "technical_director",
    )
  )
    notFound();
  const moduleOn =
    ctx.active && (ctx.subscription?.modules ?? []).includes("dna");
  const { data: rows } = await ctx.supabase
    .from("club_dna")
    .select("status, content")
    .eq("club_id", clubId)
    .in("status", ["draft", "published"]);
  const draft = (rows ?? []).find((r) => r.status === "draft");
  const published = (rows ?? []).find((r) => r.status === "published");
  const content = readClubDna((draft ?? published)?.content ?? {});
  const canPublish = ctx.roles.some(
    (r) => r === "owner" || r === "technical_director",
  );

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/clubs/${clubId}/dna`}
          className="text-sm text-brand hover:underline"
        >
          {m.back}
        </Link>
        {draft && (
          <form action={discardDnaDraft}>
            <input type="hidden" name="clubId" value={clubId} />
            <ConfirmButton label={m.discard} confirmText={m.discardConfirm} />
          </form>
        )}
      </div>
      {!moduleOn ? (
        <Alert tone="error">{m.moduleOff}</Alert>
      ) : (
        <>
          {!canPublish && (
            <p className="text-sm text-slate-600">{m.onlyApprovers}</p>
          )}
          <DnaForm
            clubId={clubId}
            questionnaire={clubDnaQuestionnaire}
            formations={formationCatalog}
            content={content}
            canPublish={canPublish}
            hasDraft={!!draft}
          />
        </>
      )}
    </div>
  );
}
