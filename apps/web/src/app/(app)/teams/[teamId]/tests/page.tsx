import { messages } from "@/lib/messages";
import { testCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";
import { addDays, longDate, mondayOf, todayInBelgium } from "@/lib/weeks/dates";

import { deleteTestSession } from "./actions";
import { TestForm } from "./test-form";

const m = messages.tests;

export default async function TestsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const [{ data: players }, { data: results }] = await Promise.all([
    supabase.from("players").select("id, first_name, last_name, shirt_number, archived_at").eq("team_id", team.id),
    supabase.from("fitness_tests").select("*").eq("team_id", team.id).order("test_date", { ascending: false }),
  ]);
  const squad = (players ?? [])
    .filter((p) => !p.archived_at)
    .sort((a, b) => (a.shirt_number ?? 999) - (b.shirt_number ?? 999));
  const label = (p: (typeof squad)[number]) =>
    `${p.shirt_number ? `#${p.shirt_number} ` : ""}${p.first_name} ${p.last_name}`;
  const today = todayInBelgium();

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">{m.intro}</p>
      {testCatalog.testen.map((test) => {
        const rows = (results ?? []).filter((r) => r.test_code === test.code);
        const dates = [...new Set(rows.map((r) => r.test_date))];
        const last = dates[0] ?? null;
        const nextWeek = last ? mondayOf(addDays(last, test.interval_weken * 7)) : null;
        const latestFor = (playerId: string) => rows.find((r) => r.player_id === playerId);

        return (
          <section key={test.code} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{test.naam}</h2>
              <p className="text-sm text-slate-600">{test.uitleg}</p>
              <p className="mt-1 text-sm font-medium">
                {!last ? m.never : nextWeek && nextWeek <= mondayOf(today) ? m.dueNow : m.due(longDate(nextWeek!))}
              </p>
            </div>

            {squad.length === 0 ? (
              <p className="text-sm text-slate-500">{m.noPlayers}</p>
            ) : (
              <table className="w-full rounded-xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">{messages.players.title}</th>
                    <th className="px-4 py-2 text-right font-medium">{m.latest}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {squad.map((p) => {
                    const r = latestFor(p.id);
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-2">{label(p)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r ? (
                            <>
                              <span className="font-medium">
                                {Number(r.result).toLocaleString("nl-BE")} {test.eenheid}
                              </span>{" "}
                              <span className="text-xs text-slate-500">({longDate(r.test_date)})</span>
                            </>
                          ) : (
                            "–"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {canEdit && squad.length > 0 && (
              <TestForm
                teamId={team.id}
                test={test}
                today={today}
                players={squad.map((p) => ({ id: p.id, label: label(p) }))}
              />
            )}

            {dates.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-600">{m.history}</h3>
                <ul className="divide-y divide-slate-100 rounded-xl bg-white text-sm ring-1 ring-slate-200">
                  {dates.map((date) => (
                    <li key={date} className="flex items-center justify-between px-4 py-2">
                      <span>
                        {longDate(date)} · {rows.filter((r) => r.test_date === date).length} {messages.players.title.toLowerCase()}
                      </span>
                      {canEdit && (
                        <form action={deleteTestSession}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <input type="hidden" name="testCode" value={test.code} />
                          <input type="hidden" name="date" value={date} />
                          <button type="submit" className="text-xs text-red-700 hover:underline">
                            {m.delete}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
