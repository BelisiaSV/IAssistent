import Link from "next/link";
import { notFound } from "next/navigation";

import { ClubExerciseForm } from "@/components/clubs/club-exercise-form";
import { saveClubExercise } from "@/lib/clubs/exercise-actions";
import {
  CLUB_EXERCISE_COLUMNS,
  type ClubExerciseRow,
} from "@/lib/clubs/exercises";
import { getClubContext } from "@/lib/clubs/load";
import { bankZones } from "@/lib/exercise-bank/filters";
import { formValues } from "@/lib/exercise-bank/form";
import { messages } from "@/lib/messages";

const m = messages.club.exercises;

/** Change a club exercise: the author his proposal, owner/admin/TD any exercise. */
export default async function EditClubExercisePage({
  params,
}: {
  params: Promise<{ clubId: string; exerciseId: string }>;
}) {
  const { clubId, exerciseId } = await params;
  const ctx = await getClubContext(clubId);
  const { data } = await ctx.supabase
    .from("club_exercises")
    .select(CLUB_EXERCISE_COLUMNS)
    .eq("id", exerciseId)
    .eq("club_id", clubId)
    .maybeSingle();
  if (!data) notFound();
  const row = data as ClubExerciseRow;
  const editor = ctx.roles.some(
    (r) => r === "owner" || r === "admin" || r === "technical_director",
  );
  if (!editor && !(row.created_by === ctx.user.id && row.status === "proposed"))
    notFound();
  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href={`/clubs/${clubId}/exercises/${row.id}`}
        className="text-sm text-brand hover:underline"
      >
        ← {row.number} · {row.title}
      </Link>
      <ClubExerciseForm
        action={saveClubExercise.bind(null, clubId, row.id, {
          origin: row.origin as "club",
        })}
        initial={formValues(row)}
        zones={bankZones(row)}
        ages={row.age_categories}
        level={row.level ?? ""}
        hint={editor ? m.editorHint : m.proposeHint}
      />
    </div>
  );
}
