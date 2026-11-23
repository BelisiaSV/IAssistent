import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Badge } from "@/components/admin/rows";
import { ConfirmButton } from "@/components/clubs/forms";
import { CommentForm } from "@/components/clubs/knowledge-forms";
import { SharedTrainingView } from "@/components/clubs/shared-training";
import { readSharedTraining } from "@/lib/clubs/knowledge";
import { deleteComment, removeSharedTraining, setExample } from "@/lib/clubs/knowledge-actions";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { longDate } from "@/lib/weeks/dates";

const m = messages.club.knowledge;
const categories = messages.ageCategories as Record<string, string>;
const dateTime = new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Brussels" });

/** One shared training: its parts, the trainer's note and the feedback of other trainers. */
export default async function SharedTrainingPage({ params }: { params: Promise<{ clubId: string; trainingId: string }> }) {
  const { clubId, trainingId } = await params;
  if (!z.uuid().safeParse(trainingId).success) notFound();
  const ctx = await getClubContext(clubId);
  if (!(ctx.subscription?.modules ?? []).includes("knowledge")) notFound();
  const { supabase } = ctx;
  const { data: training } = await supabase.from("club_shared_trainings").select("*").eq("id", trainingId).eq("club_id", clubId).maybeSingle();
  if (!training) notFound();
  const content = readSharedTraining(training.content);
  const [{ data: comments }, { data: team }, { data: people }] = await Promise.all([
    supabase.from("club_training_comments").select("id, body, author_id, created_at").eq("training_id", trainingId).order("created_at"),
    supabase.from("teams").select("name").eq("id", training.team_id).maybeSingle(),
    supabase.rpc("club_member_names", { p_club_id: clubId }),
  ]);
  const me = ctx.user.id;
  const name = new Map((people ?? []).map((p) => [p.coach_id, p.name]));
  const editor = ctx.roles.some((r) => r === "owner" || r === "admin" || r === "technical_director");

  return (
    <div className="space-y-5">
      <Link href={`/clubs/${clubId}/knowledge`} className="text-xs text-brand hover:underline">
        {m.back}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{training.title}</h2>
          <p className="text-xs text-slate-500">
            {categories[training.age_category] ?? training.age_category} · {team?.name ?? "—"} · {longDate(training.session_date)}
            {training.shared_by && name.get(training.shared_by) ? ` · ${name.get(training.shared_by)}` : ""}
          </p>
        </div>
        {training.is_example && <Badge tone="green">{m.example}</Badge>}
        {editor && (
          <form action={setExample}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="trainingId" value={training.id} />
            <input type="hidden" name="example" value={training.is_example ? "0" : "1"} />
            <button type="submit" className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
              {training.is_example ? m.unmarkExample : m.markExample}
            </button>
          </form>
        )}
        {(editor || training.shared_by === me) && (
          <form action={removeSharedTraining}>
            <input type="hidden" name="clubId" value={clubId} />
            <input type="hidden" name="trainingId" value={training.id} />
            <ConfirmButton label={m.removeTraining} confirmText={m.removeTrainingConfirm} />
          </form>
        )}
      </div>

      {training.note && (
        <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
          <span className="font-semibold">{m.note}:</span> {training.note}
        </p>
      )}
      {content && <SharedTrainingView training={content} />}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">{m.feedback}</h3>
        {(comments ?? []).length === 0 && <p className="text-xs text-slate-500">{m.noComments}</p>}
        <ul className="space-y-2">
          {(comments ?? []).map((c) => (
            <li key={c.id} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{name.get(c.author_id) ?? "—"}</span>
                <span>{dateTime.format(new Date(c.created_at))}</span>
                {(c.author_id === me || editor) && (
                  <form action={deleteComment} className="ml-auto">
                    <input type="hidden" name="clubId" value={clubId} />
                    <input type="hidden" name="trainingId" value={training.id} />
                    <input type="hidden" name="commentId" value={c.id} />
                    <ConfirmButton label={m.remove} confirmText={m.removeConfirm} />
                  </form>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ul>
        <CommentForm clubId={clubId} trainingId={training.id} />
      </section>
    </div>
  );
}
