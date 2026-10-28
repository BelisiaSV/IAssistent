import Link from "next/link";

import { EmptyState } from "@/components/card";
import { MiniPitch } from "@/components/mini-pitch";
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
    <div className="space-y-5">
      {canEdit && <NewLineupForm teamId={team.id} formations={formationCatalog} />}
      {lineups.length === 0 ? (
        <EmptyState text={m.empty} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lineups.map((lineup) => {
            const starters = (lineup.starters ?? {}) as Record<string, string>;
            const slots = formationCatalog.formaties.find((f) => f.code === lineup.formation)?.posten ?? [];
            const filled = Object.keys(starters).length;
            const complete = slots.length > 0 && filled === slots.length;
            return (
              <li key={lineup.id}>
                <Link
                  href={`/teams/${team.id}/lineups/${lineup.id}`}
                  className="flex h-full gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
                >
                  <div className="h-28 w-[4.5rem] shrink-0">
                    <MiniPitch slots={slots} filled={new Set(Object.keys(starters))} color={team.primary_color} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">{lineup.formation}</span>
                      {lineup.source === "tactical-coach" && (
                        <span className="truncate rounded-md bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">{m.fromTacticalCoach}</span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 font-bold text-slate-900">{lineup.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[lineup.match_date ? dateFormat.format(new Date(lineup.match_date)) : null, lineup.opponent].filter(Boolean).join(" · ")}
                    </p>
                    <p className={`mt-auto pt-2 text-xs font-semibold ${complete ? "text-emerald-700" : "text-slate-500"}`}>
                      {m.selectedCount(filled, slots.length, lineup.bench.length)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
