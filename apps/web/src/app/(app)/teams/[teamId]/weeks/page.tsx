import Link from "next/link";

import { Button } from "@/components/ui";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, longDate, mondayOf, shortDate, todayInBelgium } from "@/lib/weeks/dates";
import { trainingScheduleSchema, type WeekMatch } from "@/lib/weeks/validation";

import { openWeek } from "./actions";

const m = messages.weeks;

export default async function WeeksPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("week_plans")
    .select("id, week_start, matches, staff_runs(kind, version, status, deleted_at)")
    .eq("team_id", team.id)
    .order("week_start", { ascending: false })
    .limit(30);
  const weeks = data ?? [];

  const thisMonday = mondayOf(todayInBelgium());
  const options = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, (i - 1) * 7));
  const schedule = trainingScheduleSchema.safeParse(team.training_schedule);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">{m.intro}</p>
      {canEdit && (!schedule.success || schedule.data.length === 0 || (!team.competition_start_date && !team.preparation_start_date)) && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          {messages.settings.missing}{" "}
          <Link href={`/teams/${team.id}/settings`} className="font-medium underline">
            {messages.settings.open}
          </Link>
        </p>
      )}

      {canEdit && (
        <form
          action={openWeek.bind(null, team.id)}
          className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <label className="text-sm">
            <span className="block font-medium text-slate-700">{m.chooseWeek}</span>
            <select
              name="weekStart"
              defaultValue={thisMonday}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {options.map((monday) => (
                <option key={monday} value={monday}>
                  {shortDate(monday)} – {shortDate(addDays(monday, 6))}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">{m.plan}</Button>
        </form>
      )}

      {weeks.length === 0 ? (
        <p className="text-slate-600">{m.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {weeks.map((week) => {
            const runs = (week.staff_runs ?? []).filter((x) => x.kind === "week" && !x.deleted_at);
            const latest = [...runs].sort((a, b) => b.version - a.version)[0];
            const approved = runs.some((x) => x.status === "approved");
            const opponents = ((week.matches ?? []) as WeekMatch[]).map((match) => match.opponent);
            return (
              <li key={week.id}>
                <Link
                  href={`/teams/${team.id}/weeks/${week.week_start}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.weekOf(longDate(week.week_start))}</span>
                    <span className="block truncate text-xs text-slate-500">{opponents.join(" · ")}</span>
                  </span>
                  {latest && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {messages.proposals.version(latest.version)} ·{" "}
                      {messages.proposals.status[approved ? "approved" : latest.status]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
