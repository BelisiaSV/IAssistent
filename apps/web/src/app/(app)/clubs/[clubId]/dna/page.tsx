import { readClubDna, visionAnswerKey } from "@iassistent/staff-engine/content";

import { ButtonLink, Card, CardHeader, EmptyState } from "@/components/card";
import { Alert } from "@/components/ui";
import { answerText } from "@/lib/clubs/answer-text";
import { getClubContext } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { clubDnaQuestionnaire, formationCatalog } from "@/lib/staff";
import { AGE_CATEGORIES } from "@/lib/teams/age-categories";
import { longDate } from "@/lib/weeks/dates";

const m = messages.club.dna;
const categories = messages.ageCategories as Record<string, string>;

/** The club's DNA as published, with the levels, the goals per age category and the versions. */
export default async function ClubDnaPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const ctx = await getClubContext(clubId);
  const editor = ctx.roles.some(
    (r) => r === "owner" || r === "admin" || r === "technical_director",
  );
  const moduleOn =
    ctx.active && (ctx.subscription?.modules ?? []).includes("dna");
  const { data: versions } = await ctx.supabase
    .from("club_dna")
    .select("id, version, status, content, note, published_at")
    .eq("club_id", clubId)
    .order("version", { ascending: false });
  const published =
    (versions ?? []).find((v) => v.status === "published") ?? null;
  const draft = (versions ?? []).find((v) => v.status === "draft") ?? null;
  const content = published ? readClubDna(published.content) : null;
  const q = clubDnaQuestionnaire;

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-sm text-slate-600">{m.intro}</p>
      {!moduleOn && <Alert tone="error">{m.moduleOff}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {published?.published_at && (
          <p className="text-sm font-medium">
            {m.published(
              published.version,
              longDate(published.published_at.slice(0, 10)),
            )}
          </p>
        )}
        {editor && draft && (
          <p className="text-sm text-amber-700">{m.draft(draft.version)}</p>
        )}
        {editor && moduleOn && (
          <ButtonLink href={`/clubs/${clubId}/dna/edit`}>
            {draft ? m.continueDraft : published ? m.edit : m.startDraft}
          </ButtonLink>
        )}
      </div>

      {!content ? (
        <EmptyState text={editor ? m.noneEditor : m.none} />
      ) : (
        <>
          {content.samenvatting && (
            <Card>
              <CardHeader title={m.summary} />
              <p className="px-5 pb-4 text-sm whitespace-pre-line">
                {content.samenvatting}
              </p>
            </Card>
          )}
          {q.themas.map((theme) => {
            const answered = theme.vragen.filter(
              (v) =>
                content.antwoorden[visionAnswerKey(theme.id, v.id)] !==
                undefined,
            );
            if (!answered.length) return null;
            return (
              <Card key={theme.id}>
                <CardHeader title={theme.titel} />
                <dl className="space-y-3 px-5 pb-4 text-sm">
                  {answered.map((vraag) => {
                    const key = visionAnswerKey(theme.id, vraag.id);
                    const level = content.niveaus[key] ?? "aanbevolen";
                    return (
                      <div key={key}>
                        <dt className="flex flex-wrap items-center gap-2 font-medium">
                          {vraag.vraag}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${level === "verplicht" ? "bg-rose-100 text-rose-800" : "bg-sky-100 text-sky-800"}`}
                          >
                            {m[level]}
                          </span>
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-line text-slate-700">
                          {answerText(
                            vraag,
                            content.antwoorden[key]!,
                            formationCatalog,
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </Card>
            );
          })}
          <Card>
            <CardHeader title={m.ageGoals} />
            <div className="grid gap-4 px-5 pb-4 text-sm sm:grid-cols-2">
              {AGE_CATEGORIES.map((category) => {
                const goals = q.leeftijdsdoelen.vragen.filter(
                  (v) =>
                    content.leeftijdsdoelen[visionAnswerKey(category, v.id)] !==
                    undefined,
                );
                if (!goals.length) return null;
                return (
                  <div
                    key={category}
                    className="space-y-1.5 rounded-xl bg-slate-50 p-3"
                  >
                    <p className="font-semibold">
                      {categories[category] ?? category}
                    </p>
                    {goals.map((vraag) => (
                      <p key={vraag.id}>
                        <span className="text-slate-500">{vraag.vraag}: </span>
                        <span className="whitespace-pre-line">
                          {answerText(
                            vraag,
                            content.leeftijdsdoelen[
                              visionAnswerKey(category, vraag.id)
                            ]!,
                            formationCatalog,
                          )}
                        </span>
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {editor && (versions ?? []).some((v) => v.status !== "draft") && (
        <Card>
          <CardHeader title={m.history} />
          <ul className="divide-y divide-slate-100 px-5 pb-4 text-sm">
            {(versions ?? [])
              .filter((v) => v.status !== "draft")
              .map((v) => (
                <li key={v.id} className="flex flex-wrap gap-x-3 py-2">
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-slate-500">
                    {v.published_at
                      ? longDate(v.published_at.slice(0, 10))
                      : ""}
                  </span>
                  <span>
                    {v.status === "published" ? m.current : m.archived}
                  </span>
                  {v.note && <span className="text-slate-600">— {v.note}</span>}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
