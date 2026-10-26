import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";

import { createExercise } from "../actions";
import { EMPTY_EXERCISE, ExerciseForm } from "../exercise-form";

export default async function NewExercisePage() {
  await requireUser();
  return (
    <div className="space-y-4">
      <Link href="/exercises" className="text-sm text-slate-600 hover:text-brand">
        ← {messages.exercises.back}
      </Link>
      <h1 className="text-2xl font-semibold">{messages.exercises.new}</h1>
      <ExerciseForm action={createExercise} initial={EMPTY_EXERCISE} />
    </div>
  );
}
