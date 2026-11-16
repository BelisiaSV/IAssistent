export type Card = "yellow" | "red";

/** Suspension rules of a team (teams.yellow_card_limit, yellow_card_ban, red_card_ban). */
export interface CardRules {
  yellowLimit: number;
  yellowBan: number;
  redBan: number;
}

export interface Suspension {
  /** Matches still to serve. */
  matches: number;
  reason: Card;
  /** Yellow cards this season. */
  yellows: number;
}

export function cardRules(team: { yellow_card_limit: number; yellow_card_ban: number; red_card_ban: number }): CardRules {
  return { yellowLimit: team.yellow_card_limit, yellowBan: team.yellow_card_ban, redBan: team.red_card_ban };
}

/**
 * Who is suspended for the next match. Every n-th yellow card of the season
 * (from `since`) and every red card gives a ban; a ban is served by the
 * matches played after the card, one ban after the other.
 */
export function suspensions(
  cards: readonly { player_id: string; match_date: string; card: Card }[],
  playedMatches: readonly string[],
  rules: CardRules,
  since: string | null,
): Map<string, Suspension> {
  const matches = [...new Set(playedMatches)].sort();
  const byPlayer = new Map<string, { match_date: string; card: Card }[]>();
  for (const c of cards) {
    if (since && c.match_date < since) continue;
    byPlayer.set(c.player_id, [...(byPlayer.get(c.player_id) ?? []), c]);
  }

  const result = new Map<string, Suspension>();
  for (const [playerId, list] of byPlayer) {
    const sorted = list.toSorted((a, b) => a.match_date.localeCompare(b.match_date) || (a.card === "yellow" ? -1 : 1));
    let yellows = 0;
    const bans: { date: string; matches: number; reason: Card }[] = [];
    for (const c of sorted) {
      if (c.card === "yellow") {
        yellows += 1;
        if (yellows % rules.yellowLimit === 0 && rules.yellowBan > 0) bans.push({ date: c.match_date, matches: rules.yellowBan, reason: "yellow" });
      } else if (rules.redBan > 0) {
        bans.push({ date: c.match_date, matches: rules.redBan, reason: "red" });
      }
    }
    // Serve the bans one after the other with the matches played after each card.
    let next = 0;
    let owed = 0;
    let reason: Card = "yellow";
    for (const ban of bans) {
      while (next < matches.length && matches[next]! <= ban.date) next += 1;
      let left = ban.matches;
      while (left > 0 && next < matches.length) {
        left -= 1;
        next += 1;
      }
      if (left > 0) {
        owed += left;
        reason = ban.reason;
      }
    }
    if (owed > 0) result.set(playerId, { matches: owed, reason, yellows });
  }
  return result;
}

/** Yellow cards per player this season (from `since`). */
export function yellowCounts(cards: readonly { player_id: string; match_date: string; card: Card }[], since: string | null) {
  const counts = new Map<string, number>();
  for (const c of cards) {
    if (c.card !== "yellow" || (since && c.match_date < since)) continue;
    counts.set(c.player_id, (counts.get(c.player_id) ?? 0) + 1);
  }
  return counts;
}
