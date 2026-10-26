import { EXERCISE_VIDEOS_BUCKET, TEAM_LOGOS_BUCKET } from "@iassistent/db";
import Link from "next/link";

import { AnimatedDrawing } from "@/components/proposals/animated-drawing";
import { requireUser } from "@/lib/auth";
import { parseAnimation } from "@/lib/animation/schema";
import { themeForTeam } from "@/lib/animation/team-theme";
import { messages } from "@/lib/messages";

import { deleteExercise, removeAnimation, removeVideo } from "../actions";
import { loadExercise } from "./load";
import { AnimationImportForm, ConfirmButton, VideoUploadForm } from "./media-forms";

const m = messages.exercises;

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ exerciseId: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { exerciseId } = await params;
  const { team: teamParam } = await searchParams;
  const { exercise, supabase } = await loadExercise(exerciseId);
  const user = await requireUser();

  // Display: colours and logo of one of the coach's teams.
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, logo_path, animation_settings, archived_at")
    .eq("head_coach_id", user.id)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  const team = (teams ?? []).find((t) => t.id === teamParam) ?? teams?.[0] ?? null;
  const display = themeForTeam(team?.animation_settings);
  const [logo, video] = await Promise.all([
    team?.logo_path ? supabase.storage.from(TEAM_LOGOS_BUCKET).createSignedUrl(team.logo_path, 3600) : null,
    exercise.video_path ? supabase.storage.from(EXERCISE_VIDEOS_BUCKET).createSignedUrl(exercise.video_path, 3600) : null,
  ]);
  const animation = exercise.animation ? parseAnimation(exercise.animation) : null;

  const list = (title: string, items: string[], ordered = false) =>
    items.length > 0 && (
      <div>
        <p className="text-sm font-medium">{title}</p>
        {ordered ? (
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/exercises" className="text-sm text-slate-600 hover:text-brand">
          ← {m.back}
        </Link>
        <Link href={`/exercises/${exercise.id}/edit`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {m.edit}
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{exercise.title}</h1>
        <p className="text-sm text-slate-600">
          {[
            exercise.phase ? m.phase[exercise.phase] : null,
            m.players(exercise.min_players, exercise.max_players),
            exercise.duration_min ? m.minutes(exercise.duration_min) : null,
            m.load(exercise.sets, exercise.work_min === null ? null : Number(exercise.work_min), exercise.rest_min === null ? null : Number(exercise.rest_min)),
            exercise.intensity ? m.intensity[exercise.intensity] : null,
            exercise.rpe ? m.rpe(exercise.rpe) : null,
            exercise.use_in_planning ? null : m.notInPlanning,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {exercise.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {exercise.labels.map((l) => (
              <span key={l} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {l}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {(teams ?? []).length > 1 && animation && (
            <form className="flex items-center gap-2 text-sm">
              <label htmlFor="team" className="text-slate-600">
                {m.media.viewAs}
              </label>
              <select id="team" name="team" defaultValue={team?.id} className="rounded-md border border-slate-300 bg-white px-2 py-1">
                {(teams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-1">
                OK
              </button>
            </form>
          )}
          {animation && (
            <AnimatedDrawing animation={animation} theme={display.theme} logoUrl={logo?.data?.signedUrl ?? null} logoOn={display.logoOn} labels={m.player} />
          )}
          {video?.data?.signedUrl && (
            <video src={video.data.signedUrl} controls className="w-full rounded-xl bg-black" />
          )}
          {!animation && !video && <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">{m.media.none}</p>}
        </div>

        <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {exercise.organisation && (
            <p className="text-sm">
              <span className="font-medium">{m.form.organisation}:</span> {exercise.organisation}
            </p>
          )}
          {list(m.form.course, exercise.course, true)}
          {list(m.form.coaching, exercise.coaching_points)}
          {list(m.form.variations, exercise.variations)}
        </div>
      </div>

      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">{m.media.title}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">{m.media.animation}</p>
            <p className="text-xs text-slate-500">{m.media.animationHint}</p>
            <AnimationImportForm exerciseId={exercise.id} />
            {exercise.animation && <ConfirmButton action={removeAnimation} exerciseId={exercise.id} label={m.media.animationRemove} />}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{m.media.video}</p>
            <p className="text-xs text-slate-500">{m.media.videoHint}</p>
            <VideoUploadForm exerciseId={exercise.id} />
            {exercise.video_path && <ConfirmButton action={removeVideo} exerciseId={exercise.id} label={m.media.videoRemove} />}
          </div>
        </div>
      </section>

      <div className="text-right">
        <ConfirmButton action={deleteExercise} exerciseId={exercise.id} label={m.delete} confirmText={m.deleteConfirm} />
      </div>
    </div>
  );
}
