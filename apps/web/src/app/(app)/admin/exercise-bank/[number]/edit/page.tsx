import Link from "next/link";
import { notFound } from "next/navigation";

import { isPlatformAdmin } from "@/lib/admin";
import { bankZones } from "@/lib/exercise-bank/filters";
import { bankMediaUrls } from "@/lib/exercise-bank/load";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { BankEditForm } from "./bank-edit-form";
import { ExerciseMediaForm } from "./media-form";

const m = messages.exerciseBank.admin;

/** Admin only: correct the texts of a bank exercise. */
export default async function EditBankExercisePage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { data: row } = await supabase
    .from("bank_exercises")
    .select("number, title, kind, phase, target_group, tags, content, media_kind, media_path")
    .eq("number", decodeURIComponent(number))
    .maybeSingle();
  if (!row) notFound();
  const c = (row.content ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const lines = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").join("\n") : "");

  return (
    <div className="space-y-4">
      <Link href="/admin/exercise-bank" className="text-sm font-medium text-brand hover:underline">
        ← {m.back}
      </Link>
      <div className="max-w-3xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.editTitle(row.number)}</h1>
        <p className="text-sm text-slate-600">{m.editIntro}</p>
      </div>
      <ExerciseMediaForm
        number={row.number}
        kind={row.media_kind}
        url={row.media_path ? ((await bankMediaUrls(supabase, [row.media_path])).get(row.media_path) ?? null) : null}
      />
      <BankEditForm
        number={row.number}
        zones={bankZones(row)}
        initial={{
          titel: row.title,
          type: row.kind,
          spelfase: row.phase ?? "",
          doelgroep: row.target_group ?? "",
          hoofddoel: text(c.hoofddoel),
          subdoelen: lines(c.subdoelen),
          principes: lines(c.principes),
          aantal_spelers: text(c.aantal_spelers),
          duur: text(c.duur),
          veldafmeting: text(c.veldafmeting),
          belasting: text(c.belasting),
          belasting_toelichting: text(c.belasting_toelichting),
          organisatie: lines(c.organisatie),
          verloop: lines(c.verloop),
          regels: text(c.regels),
          coachingspunten: lines(c.coachingspunten),
          makkelijker: text(c.makkelijker),
          moeilijker: text(c.moeilijker),
          materiaal: lines(c.materiaal),
          tags: row.tags.join(", "),
        }}
      />
    </div>
  );
}
