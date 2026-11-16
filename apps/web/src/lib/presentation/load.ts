import "server-only";

import { TEAM_MEDIA_BUCKET } from "@iassistent/db";

import { opponentKey } from "@/lib/opponents/context";
import type { TacticalWeekOutput } from "@/lib/proposals/types";
import { formationCatalog } from "@/lib/staff";
import { createClient } from "@/lib/supabase/server";
import { type NextMatch, nextMatch } from "@/lib/teams/dashboard";
import { getTeamContext } from "@/lib/teams/queries";
import { mondayOf, todayInBelgium } from "@/lib/weeks/dates";

import { opponentStats, sameTeam } from "./stats";
import type { PresentationData, SlideLineup } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function signed(
  supabase: Supabase,
  bucket: string,
  paths: (string | null)[],
) {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (!wanted.length) return urls;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(wanted, 3600);
  for (const item of data ?? [])
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}

/**
 * The data of the match presentation for a match of the team (the next one,
 * or the one on `date`). Names are only shown; nothing here goes to the AI.
 */
export async function loadPresentation(
  teamId: string,
  date: string | undefined,
): Promise<PresentationData> {
  const { team, logoUrl, canEdit } = await getTeamContext(teamId);
  const supabase = await createClient();
  const today = todayInBelgium();

  const { data: weeks } = await supabase
    .from("week_plans")
    .select("week_start, matches")
    .eq("team_id", team.id)
    .gte("week_start", mondayOf(today))
    .order("week_start")
    .limit(8);
  const upcoming: NextMatch[] = [];
  for (let i = 0; i < 6; i += 1) {
    const next = nextMatch(
      weeks ?? [],
      i === 0 ? today : addDay(upcoming.at(-1)!.date),
    );
    if (!next) break;
    upcoming.push(next);
  }
  const match = upcoming.find((m) => m.date === date) ?? upcoming[0] ?? null;

  const [{ data: opponents }, { data: players }] = await Promise.all([
    supabase
      .from("opponents")
      .select("id, name, logo_path, shirt_color, shirt_trim_color")
      .eq("team_id", team.id),
    supabase
      .from("players")
      .select("id, first_name, last_name, shirt_number")
      .eq("team_id", team.id),
  ]);
  const logos = await signed(
    supabase,
    TEAM_MEDIA_BUCKET,
    (opponents ?? []).map((o) => o.logo_path),
  );
  const ficheOf = (name: string) =>
    (opponents ?? []).find((x) => opponentKey(x.name) === opponentKey(name));
  const logoOf = (name: string) => {
    const o = ficheOf(name);
    return o?.logo_path ? (logos.get(o.logo_path) ?? null) : null;
  };
  const fiche = match ? ficheOf(match.opponent) : undefined;

  const base: PresentationData = {
    team: {
      id: team.id,
      name: team.name,
      clubName: team.club_name,
      primary: team.primary_color,
      secondary: team.secondary_color,
      logoUrl,
    },
    match: match
      ? {
          date: match.date,
          start: match.start,
          home: match.home,
          opponent: match.opponent,
        }
      : null,
    matches: upcoming.map((m) => ({ date: m.date, opponent: m.opponent })),
    opponent: match
      ? {
          name: match.opponent,
          logoUrl: logoOf(match.opponent),
          shirt: fiche?.shirt_color ?? null,
          trim: fiche?.shirt_trim_color ?? null,
        }
      : null,
    stats: null,
    opponentLineup: null,
    ownLineup: null,
    principle: null,
    canEdit,
  };
  if (!match) return base;

  // Competition: position and the last five results of the opponent.
  if (team.federation_team && team.federation_divisions.length) {
    const [{ data: compMatches }, { data: standings }] = await Promise.all([
      supabase
        .from("competition_matches")
        .select("*")
        .in("division", team.federation_divisions),
      supabase
        .from("competition_standings")
        .select("*")
        .in("division", team.federation_divisions)
        .eq("period", 0),
    ]);
    const all = compMatches ?? [];
    const name = all
      .flatMap((m) => [m.home, m.away])
      .find((n) => sameTeam(n, match.opponent));
    if (name) {
      const row = (standings ?? []).find((s) => sameTeam(s.team, name));
      const s = opponentStats(all, name, row?.position ?? null, match.date);
      base.stats = {
        ...s,
        last: s.last.map((r) => ({
          outcome: r.outcome,
          opponent: r.opponent,
          logoUrl: logoOf(r.opponent),
        })),
      };
    }
  }

  // Opponent lineup (latest entered by the coach).
  if (fiche) {
    const { data: lineup } = await supabase
      .from("opponent_lineups")
      .select("formation, starters")
      .eq("opponent_id", fiche.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const formation = lineup
      ? formationCatalog.formaties.find((f) => f.code === lineup.formation)
      : undefined;
    if (lineup && formation) {
      const starters = lineup.starters as Record<
        string,
        { number?: number; name?: string }
      >;
      base.opponentLineup = {
        formation: formation.naam,
        players: formation.posten.flatMap((slot) => {
          const p = starters[slot.id];
          return p
            ? [
                {
                  x: slot.x,
                  y: slot.y,
                  number: p.number ?? null,
                  name: p.name ?? "",
                  detail: null,
                  goalkeeper: slot.positie === "GK",
                },
              ]
            : [];
        }),
      };
    }
  }

  // Own lineup: the newest one for this match, else the latest one.
  const { data: lineups } = await supabase
    .from("lineups")
    .select("formation, starters, match_date")
    .eq("team_id", team.id)
    .order("match_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const forMatch = (lineups ?? []).filter((l) => l.match_date === match.date);
  const byId = new Map((players ?? []).map((p) => [p.id, p]));
  base.ownLineup =
    (forMatch.length ? forMatch : (lineups ?? []))
      .slice(0, 1)
      .flatMap((l): SlideLineup[] => {
        const formation = formationCatalog.formaties.find(
          (f) => f.code === l.formation,
        );
        if (!formation) return [];
        const starters = l.starters as Record<string, string>;
        return [
          {
            formation: formation.naam,
            players: formation.posten.flatMap((slot) => {
              const p = starters[slot.id]
                ? byId.get(starters[slot.id]!)
                : undefined;
              return p
                ? [
                    {
                      x: slot.x,
                      y: slot.y,
                      number: p.shirt_number,
                      name: p.last_name || p.first_name,
                      detail: p.last_name ? p.first_name || null : null,
                      goalkeeper: slot.positie === "GK",
                    },
                  ]
                : [];
            }),
          },
        ];
      })[0] ?? null;

  // Principle of the week from the Tactical Coach (approved first, else the latest).
  const { data: week } = await supabase
    .from("week_plans")
    .select("id")
    .eq("team_id", team.id)
    .eq("week_start", match.weekStart)
    .maybeSingle();
  if (week) {
    const { data: plans } = await supabase
      .from("staff_proposals")
      .select("status, output, version")
      .eq("week_plan_id", week.id)
      .eq("role", "tactical-coach")
      .eq("task", "default")
      .not("output", "is", null)
      .order("version", { ascending: false });
    const plan = (
      (plans ?? []).find((p) => p.status === "approved") ?? plans?.[0]
    )?.output as Partial<TacticalWeekOutput> | undefined;
    if (plan?.principe)
      base.principle = {
        title: plan.principe.titel,
        explanation: plan.principe.uitleg,
        drawing: plan.principe.tekening,
      };
    else if (plan?.speelplan)
      base.principle = {
        title: plan.speelplan.kernboodschap,
        explanation: "",
        drawing: null,
      };
  }
  return base;
}

function addDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
