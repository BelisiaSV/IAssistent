import { shareExerciseWithClub } from "@/lib/clubs/exercise-actions";
import { loadMyClubs } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const m = messages.club.exercises.share;

/** Propose this exercise to each club of the coach that has the shared exercise library. */
export async function ShareWithClub({ exerciseId }: { exerciseId: string }) {
  const clubs = await loadMyClubs();
  if (!clubs.length) return null;
  const supabase = await createClient();
  const { data: subscriptions } = await supabase
    .from("club_subscriptions")
    .select("club_id, modules")
    .in(
      "club_id",
      clubs.map((c) => c.id),
    );
  const withModule = clubs.filter((c) =>
    (subscriptions ?? [])
      .find((s) => s.club_id === c.id)
      ?.modules.includes("exercises"),
  );
  if (!withModule.length) return null;
  return (
    <section className="space-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">{m.title}</h2>
      <p className="text-sm text-slate-600">{m.intro}</p>
      <div className="flex flex-wrap gap-2">
        {withModule.map((club) => (
          <form key={club.id} action={shareExerciseWithClub}>
            <input type="hidden" name="exerciseId" value={exerciseId} />
            <input type="hidden" name="clubId" value={club.id} />
            <button
              type="submit"
              className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            >
              {m.button(club.name)}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
