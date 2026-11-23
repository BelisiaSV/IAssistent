import { CLUB_DOCUMENTS_BUCKET } from "@iassistent/db";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Modal } from "@/components/admin/modal";
import { Badge, Row, Rows } from "@/components/admin/rows";
import { ConfirmButton } from "@/components/clubs/forms";
import { DocumentUploadForm } from "@/components/clubs/knowledge-forms";
import { deleteDocument } from "@/lib/clubs/knowledge-actions";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";
import { shortDate } from "@/lib/weeks/dates";

const m = messages.club.knowledge;
const categories = messages.ageCategories as Record<string, string>;

/** Club module "knowledge": documents and guidelines, shared trainings (examples per age category) and feedback. */
export default async function ClubKnowledgePage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ categorie?: string; voorbeelden?: string }>;
}) {
  const { clubId } = await params;
  const query = await searchParams;
  const ctx = await getClubContext(clubId);
  if (!(ctx.subscription?.modules ?? []).includes("knowledge")) notFound();
  const { supabase } = ctx;
  const editor = ctx.roles.some((r) => r === "owner" || r === "admin" || r === "technical_director");
  const category = AGE_CATEGORIES.find((c) => c === query.categorie) ?? null;
  const onlyExamples = query.voorbeelden === "1";

  let trainingsQuery = supabase
    .from("club_shared_trainings")
    .select("id, team_id, session_date, title, age_category, is_example, created_at, club_training_comments(count)")
    .eq("club_id", clubId)
    .order("is_example", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (category) trainingsQuery = trainingsQuery.eq("age_category", category);
  if (onlyExamples) trainingsQuery = trainingsQuery.eq("is_example", true);

  const [{ data: documents }, { data: trainings }, { data: teams }] = await Promise.all([
    supabase.from("club_documents").select("*").eq("club_id", clubId).order("kind").order("title"),
    trainingsQuery,
    supabase.from("teams").select("id, name").eq("club_id", clubId),
  ]);
  const urls = new Map<string, string>();
  if (documents?.length) {
    const { data } = await supabase.storage.from(CLUB_DOCUMENTS_BUCKET).createSignedUrls(
      documents.map((d) => d.file_path),
      3600,
    );
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return (
    <div className="space-y-5">
      <p className="max-w-4xl text-xs text-slate-500">{m.intro}</p>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{m.documents}</h2>
          {editor && (
            <Modal label={m.newDocument} plus wide>
              <DocumentUploadForm clubId={clubId} />
            </Modal>
          )}
        </div>
        <Rows empty={m.noDocuments}>
          {(documents ?? []).map((d) => (
            <Row
              key={d.id}
              meta={
                <>
                  <Badge tone={d.kind === "guideline" ? "brand" : d.kind === "agreement" ? "sky" : "slate"}>{m.kinds[d.kind] ?? d.kind}</Badge>
                  <span>{d.age_categories.length ? d.age_categories.map((c) => categories[c] ?? c).join(", ") : m.allCategories}</span>
                  <span>{shortDate(d.created_at.slice(0, 10))}</span>
                </>
              }
              actions={
                <>
                  {urls.get(d.file_path) && (
                    <a href={urls.get(d.file_path)} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand hover:underline">
                      {m.open} →
                    </a>
                  )}
                  {editor && (
                    <form action={deleteDocument}>
                      <input type="hidden" name="clubId" value={clubId} />
                      <input type="hidden" name="documentId" value={d.id} />
                      <ConfirmButton label={m.remove} confirmText={m.removeConfirm} />
                    </form>
                  )}
                </>
              }
            >
              {d.title}
              {d.description && <span className="block text-xs font-normal text-slate-600">{d.description}</span>}
            </Row>
          ))}
        </Rows>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-700">{m.trainings}</h2>
            <p className="text-xs text-slate-500">{m.trainingsIntro}</p>
          </div>
          <form className="flex flex-wrap items-center gap-2 text-xs">
            <label htmlFor="categorie" className="font-medium text-slate-600">
              {m.filterCategory}
            </label>
            <select id="categorie" name="categorie" defaultValue={category ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-1">
              <option value="">{m.allCategories}</option>
              {AGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categories[c]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="voorbeelden" value="1" defaultChecked={onlyExamples} />
              {m.onlyExamples}
            </label>
            <button type="submit" className="rounded-md bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
              {m.filter}
            </button>
          </form>
        </div>
        <Rows empty={m.noTrainings}>
          {(trainings ?? []).map((t) => {
            const count = (t.club_training_comments as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
            return (
              <Row
                key={t.id}
                meta={
                  <>
                    <span>{categories[t.age_category] ?? t.age_category}</span>
                    <span>{m.sharedBy(teamName.get(t.team_id) ?? "—", shortDate(t.session_date))}</span>
                    <span>{m.comments(count)}</span>
                    {t.is_example && <Badge tone="green">{m.example}</Badge>}
                  </>
                }
                actions={
                  <Link href={`/clubs/${clubId}/knowledge/${t.id}`} className="text-xs font-medium text-brand hover:underline">
                    {m.open} →
                  </Link>
                }
              >
                <Link href={`/clubs/${clubId}/knowledge/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
              </Row>
            );
          })}
        </Rows>
      </div>
    </div>
  );
}
