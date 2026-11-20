import type { MatchRow } from "@/lib/competition/parse";

/** A club as found in the federation export: its registration number, name and teams. */
export interface FederationClub {
  number: string;
  name: string;
  teams: { name: string; divisions: string[] }[];
}

/** A last word that only tells teams of one club apart ("A", "B", "II", "U17", "2"). */
const TEAM_SUFFIX = /^([A-Z]|[IVX]{1,4}|U\d{1,2}|\d{1,2})$/i;

function withoutSuffix(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && TEAM_SUFFIX.test(words[words.length - 1]!))
    words.pop();
  return words.join(" ");
}

/**
 * The club name from its team names: the words they share at the start
 * ("Belisia Bilzen SV A" + "Belisia Bilzen SV B" → "Belisia Bilzen SV"),
 * or the team name without its suffix when there is one team.
 */
export function clubName(teamNames: string[]): string {
  const names = teamNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return "";
  const split = names.map((n) => n.split(/\s+/));
  const common: string[] = [];
  for (let i = 0; i < split[0]!.length; i++) {
    const word = split[0]![i]!;
    if (split.every((w) => w[i]?.toLowerCase() === word.toLowerCase()))
      common.push(word);
    else break;
  }
  const shared = common.join(" ");
  if (names.length > 1 && shared && shared.length >= 3)
    return withoutSuffix(shared);
  return withoutSuffix(names[0]!);
}

/** All clubs in the calendar and results export, by registration number, sorted by name. */
export function federationClubs(
  matches: Pick<
    MatchRow,
    "division" | "home" | "away" | "home_club" | "away_club"
  >[],
): FederationClub[] {
  const clubs = new Map<string, Map<string, Set<string>>>();
  const add = (number: string | null, team: string, division: string) => {
    const key = number?.trim();
    if (!key || !team.trim()) return;
    const teams = clubs.get(key) ?? new Map<string, Set<string>>();
    const divisions = teams.get(team.trim()) ?? new Set<string>();
    divisions.add(division);
    teams.set(team.trim(), divisions);
    clubs.set(key, teams);
  };
  for (const m of matches) {
    add(m.home_club, m.home, m.division);
    add(m.away_club, m.away, m.division);
  }
  return [...clubs.entries()]
    .map(([number, teams]) => ({
      number,
      name: clubName([...teams.keys()]),
      teams: [...teams.entries()]
        .map(([name, divisions]) => ({
          name,
          divisions: [...divisions].sort(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "nl")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}
