import Link from "next/link";

import { messages } from "@/lib/messages";

import { updateExercise } from "../../actions";
import { ExerciseForm } from "../../exercise-form";
import { loadExercise } from "../load";

export default async function EditExercisePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const { exercise } = await loadExercise(exerciseId);
  return (
    <div className="space-y-4">
      <Link href={`/exercises/${exercise.id}`} className="text-sm text-slate-600 hover:text-brand">
        ← {exercise.title}
      </Link>
      <h1 className="text-2xl font-semibold">{messages.exercises.edit}</h1>
      <ExerciseForm
        action={updateExercise.bind(null, exercise.id)}
        initial={{
          title: exercise.title,
          phase: exercise.phase ?? "",
          labels: exercise.labels.join(", "),
          minPlayers: exercise.min_players?.toString() ?? "",
          maxPlayers: exercise.max_players?.toString() ?? "",
          duration: exercise.duration_min?.toString() ?? "",
          organisation: exercise.organisation ?? "",
          course: exercise.course.join("\n"),
          coaching: exercise.coaching_points.join("\n"),
          variations: exercise.variations.join("\n"),
        }}
      />
    </div>
  );
}
