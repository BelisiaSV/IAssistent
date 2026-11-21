import Link from "next/link";

import { setClubBankPick } from "@/lib/clubs/exercise-actions";
import { loadMyClubs } from "@/lib/clubs/load";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

const m = messages.club.exercises.bank;

function PickButton({
  clubId,
  number,
  pick,
  recommended,
  label,
}: {
  clubId: string;
  number: string;
  pick: boolean;
  recommended: boolean;
  label: string;
}) {
  return (
    <form action={setClubBankPick}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="pick" value={pick ? "1" : "0"} />
      <input type="hidden" name="recommended" value={recommended ? "1" : "0"} />
      <button
        type="submit"
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
      >
        {label}
      </button>
    </form>
  );
}

/**
 * For each club of the coach with the shared exercise library: whether the
 * club picked this bank exercise, buttons to pick or recommend it (owner,
 * admin, technical director) and a link to make a club variant.
 */
export async function ClubBankSection({ number }: { number: string }) {
  const clubs = await loadMyClubs();
  if (!clubs.length) return null;
  const supabase = await createClient();
  const [{ data: subscriptions }, { data: picks }] = await Promise.all([
    supabase
      .from("club_subscriptions")
      .select("club_id, modules")
      .in(
        "club_id",
        clubs.map((c) => c.id),
      ),
    supabase
      .from("club_bank_picks")
      .select("club_id, recommended")
      .eq("bank_number", number),
  ]);
  const withModule = clubs.filter((c) =>
    (subscriptions ?? [])
      .find((s) => s.club_id === c.id)
      ?.modules.includes("exercises"),
  );
  if (!withModule.length) return null;

  return (
    <section className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{m.title}</h2>
      {withModule.map((club) => {
        const pick = (picks ?? []).find((p) => p.club_id === club.id);
        const editor = club.roles.some(
          (r) => r === "owner" || r === "admin" || r === "technical_director",
        );
        return (
          <div
            key={club.id}
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <span className="font-medium">{club.name}</span>
            {pick && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pick.recommended ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}
              >
                {pick.recommended ? m.pickedRecommended : m.picked}
              </span>
            )}
            {editor && !pick && (
              <PickButton
                clubId={club.id}
                number={number}
                pick
                recommended={false}
                label={m.pick}
              />
            )}
            {editor && !pick?.recommended && (
              <PickButton
                clubId={club.id}
                number={number}
                pick
                recommended
                label={m.pickRecommended}
              />
            )}
            {editor && pick && (
              <PickButton
                clubId={club.id}
                number={number}
                pick={false}
                recommended={false}
                label={m.unpick}
              />
            )}
            <Link
              href={`/clubs/${club.id}/exercises/new?bank=${encodeURIComponent(number)}`}
              className="text-brand hover:underline"
            >
              {m.variant} →
            </Link>
          </div>
        );
      })}
    </section>
  );
}
