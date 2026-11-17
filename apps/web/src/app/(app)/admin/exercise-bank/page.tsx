import Link from "next/link";
import { notFound } from "next/navigation";

import { BankFields } from "@/components/exercise-bank/bank-fields";
import { BankMedia } from "@/components/exercise-bank/bank-media";
import { isPlatformAdmin } from "@/lib/admin";
import { hasOpenQuestion } from "@/lib/exercise-bank/import";
import { bankMediaUrls } from "@/lib/exercise-bank/load";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { BankImport } from "./bank-import";
import { MediaUpload } from "./media-upload";
import { StatusButton } from "./status-button";

const m = messages.exerciseBank.admin;
const FILTERS = ["all", "review", "approved"] as const;
/** Admin only: the exercise bank of the platform (import, check and approve). */
export default async function AdminExerciseBankPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { status } = await searchParams;
  const filter = FILTERS.find((f) => f === status) ?? "all";

  const { data } = await supabase
    .from("bank_exercises")
    .select(
      "id, number, title, kind, phase, tags, content, media_kind, media_key, media_path, status, version, source_title, source_content",
    )
    .order("number");
  const all = data ?? [];
  const shown = filter === "all" ? all : all.filter((x) => x.status === filter);
  const keys = [...new Set(all.flatMap((x) => (x.media_key ? [x.media_key] : [])))];
  const missing = new Set(all.flatMap((x) => (x.media_key && !x.media_path ? [x.media_key] : []))).size;
  const urls = await bankMediaUrls(supabase, shown.map((x) => x.media_path));

  return (
    <div className="space-y-4">
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <BankImport existing={all.map((x) => x.number)} />
      {keys.length > 0 && <MediaUpload keys={keys} missing={missing} />}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{m.listTitle(all.length)}</h2>
          <nav className="flex gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={f === "all" ? "?" : `?status=${f}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${f === filter ? "bg-brand text-white ring-brand" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"}`}
              >
                {m.filters[f]} (
                {f === "all"
                  ? all.length
                  : all.filter((x) => x.status === f).length}
                )
              </Link>
            ))}
          </nav>
        </div>
        {all.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            {m.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {shown.map((x) => {
              const content = (x.content ?? {}) as Record<string, unknown>;
              const status = x.status === "approved" ? "approved" : "review";
              return (
                <li
                  key={x.id}
                  className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">
                        {x.number}
                      </span>
                      <span className="min-w-0 flex-1 font-medium">
                        {x.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[x.kind, x.phase].filter(Boolean).join(" · ")}
                        {x.media_kind && ` · ${m.media[x.media_kind]}${x.media_path ? "" : ` (${m.mediaMissing})`}`}
                      </span>
                      {hasOpenQuestion(content) && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {m.uncertain}
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${status === "approved" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}
                      >
                        {m.status[status]}
                      </span>
                      {x.source_content !== null &&
                        (x.title !== x.source_title || JSON.stringify(x.content) !== JSON.stringify(x.source_content)) && (
                          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">{m.edited}</span>
                        )}
                      <Link
                        href={`/admin/exercise-bank/${x.number}/edit`}
                        className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                      >
                        {m.edit}
                      </Link>
                      <StatusButton id={x.id} status={status} />
                    </summary>
                    <div className="space-y-3 border-t border-slate-200 px-4 py-3">
                      {x.media_path && (
                        <BankMedia kind={x.media_kind} url={urls.get(x.media_path) ?? null} alt={x.title} className="max-h-80 max-w-xl" />
                      )}
                      <BankFields content={content} />
                      <p className="text-xs text-slate-500">
                        {m.version(x.version)}
                        {x.tags.length > 0 &&
                          ` · ${x.tags.map((t) => `#${t}`).join(" ")}`}
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
