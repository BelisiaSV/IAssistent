import Link from "next/link";
import { notFound } from "next/navigation";

import { ClubExerciseForm } from "@/components/clubs/club-exercise-form";
import { Alert } from "@/components/ui";
import { saveClubExercise } from "@/lib/clubs/exercise-actions";
import { getClubContext } from "@/lib/clubs/load";
import { bankZones } from "@/lib/exercise-bank/filters";
import { formValues } from "@/lib/exercise-bank/form";
import { BANK_COLUMNS, type BankRow } from "@/lib/exercise-bank/staff";
import { messages } from "@/lib/messages";

const m = messages.club.exercises;

/** A new club exercise; with ?bank=OEF-007 a variant of that bank exercise. */
export default async function NewClubExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ bank?: string }>;
}) {
  const { clubId } = await params;
  const { bank } = await searchParams;
  const ctx = await getClubContext(clubId);
  const moduleOn =
    ctx.active && (ctx.subscription?.modules ?? []).includes("exercises");
  const editor = ctx.roles.some(
    (r) => r === "owner" || r === "admin" || r === "technical_director",
  );
  let base: BankRow | null = null;
  if (bank) {
    const { data } = await ctx.supabase
      .from("bank_exercises")
      .select(BANK_COLUMNS)
      .eq("number", bank)
      .eq("status", "approved")
      .maybeSingle();
    if (!data) notFound();
    base = data as BankRow;
  }
  const empty = {
    title: "",
    kind: "",
    phase: null,
    target_group: null,
    tags: [],
    content: {},
  };

  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href={`/clubs/${clubId}/exercises`}
        className="text-sm text-brand hover:underline"
      >
        {m.back}
      </Link>
      <h2 className="text-xl font-semibold">
        {base ? m.variantOf(base.number) : m.newExercise}
      </h2>
      {!moduleOn ? (
        <Alert tone="error">{m.moduleOff}</Alert>
      ) : (
        <ClubExerciseForm
          action={saveClubExercise.bind(
            null,
            clubId,
            null,
            base
              ? { origin: "bank_variant", baseBankNumber: base.number }
              : { origin: "club" },
          )}
          initial={formValues(base ?? empty)}
          zones={base ? bankZones(base) : []}
          ages={[]}
          level=""
          hint={editor ? m.editorHint : m.proposeHint}
        />
      )}
    </div>
  );
}
