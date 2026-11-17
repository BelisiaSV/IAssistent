import Link from "next/link";

import { BankFields } from "@/components/exercise-bank/bank-fields";
import { BankMedia } from "@/components/exercise-bank/bank-media";
import { Alert } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { bankMediaUrls } from "@/lib/exercise-bank/load";
import { BANK_COLUMNS, type BankRow } from "@/lib/exercise-bank/staff";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { copyBankExercise } from "../actions";
import { CopyButton } from "./copy-button";

const m = messages.exerciseBank.coach;

/** One exercise of the bank, with "take over into my library". */
export default async function BankExercisePage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ fout?: string }> }) {
  const [{ number }, { fout }] = await Promise.all([params, searchParams]);
  await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: own }] = await Promise.all([
    supabase.from("bank_exercises").select(BANK_COLUMNS).eq("number", decodeURIComponent(number)).maybeSingle(),
    supabase.from("exercises").select("id").eq("bank_number", decodeURIComponent(number)).maybeSingle(),
  ]);
  const row = data as BankRow | null;

  return (
    <div className="space-y-5">
      <Link href="/exercises/bank" className="text-sm font-medium text-brand hover:underline">
        ← {m.back}
      </Link>
      {!row ? (
        <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">{m.notFound}</p>
      ) : (
        <article className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-slate-500">{row.number}</p>
              <h1 className="text-2xl font-semibold">{row.title}</h1>
              <p className="text-sm text-slate-500">{[row.kind, row.phase].filter(Boolean).join(" · ")}</p>
            </div>
            {own ? (
              <Link href={`/exercises/${own.id}`} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-brand ring-1 ring-brand hover:bg-brand/5">
                {m.openOwn}
              </Link>
            ) : (
              <form action={copyBankExercise}>
                <input type="hidden" name="number" value={row.number} />
                <CopyButton />
              </form>
            )}
          </header>
          {fout && <Alert tone="error">{m.copyFailed}</Alert>}
          {row.media_path && (
            <BankMedia kind={row.media_kind ?? null} url={(await bankMediaUrls(supabase, [row.media_path])).get(row.media_path) ?? null} alt={row.title} className="max-h-[480px]" />
          )}
          <BankFields content={row.content} omit={["notities", "bron"]} />
          {row.tags.length > 0 && <p className="text-xs text-slate-500">{row.tags.map((t) => `#${t}`).join(" ")}</p>}
        </article>
      )}
    </div>
  );
}
