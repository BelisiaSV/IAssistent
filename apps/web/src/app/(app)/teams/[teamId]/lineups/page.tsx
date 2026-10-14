import Link from "next/link";

import { messages } from "@/lib/messages";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { getTeamContext } from "@/lib/teams/queries";

import { NewLineupForm } from "./new-lineup-form";

const m = messages.lineups;
const dateFormat = new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function LineupsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("lineups")
    .select("id, title, match_date, opponent, formation, starters, bench, source, created_at")
    .eq("team_id", team.id)
    .order("match_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });
  const lineups = data ?? [];

  return (
    <div className="space-y-6">
      {canEdit && <NewLineupForm teamId={team.id} formations={formationCatalog} />}
      {lineups.length === 0 ? (
        <p className="text-slate-600">{m.empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {lineups.map((lineup) => {
            const starters = Object.keys((lineup.starters ?? {}) as object).length;
            const slots =
              formationCatalog.formaties.find((f) => f.code === lineup.formation)?.posten.length ?? 0;
            return (
              <li key={lineup.id}>
                <Link
                  href={`/teams/${team.id}/lineups/${lineup.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{lineup.formation}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {lineup.title}
                      {lineup.source === "tactical-coach" && (
                        <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-xs font-normal text-brand">{m.fromTacticalCoach}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {[
                        lineup.match_date ? dateFormat.format(new Date(lineup.match_date)) : null,
                        lineup.opponent,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {m.selectedCount(starters, slots, lineup.bench.length)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
