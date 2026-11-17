/** Shirt number -> short name ("J. De Smet"); the AI only knows shirt numbers. */
export function shirtNames(
  players: { shirt_number: number | null; first_name: string; last_name: string; archived_at: string | null }[],
): Map<number, string> {
  return new Map(
    players
      .filter((p) => p.shirt_number !== null && !p.archived_at)
      .map((p) => [p.shirt_number!, `${p.first_name.charAt(0)}. ${p.last_name}`]),
  );
}

/** Adds the player's name after every "#<number>" in a text. */
export function withShirtNames(text: string, names: Map<number, string>): string {
  return text.replace(/#(\d{1,2})\b/g, (match, n: string) => {
    const name = names.get(Number(n));
    return name ? `${match} ${name}` : match;
  });
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces the names of players in a text of the head coach with their shirt
 * number ("#7"), before it goes to the AI. Full names first (any case), then
 * a first or last name on its own (as written in the squad, with a capital,
 * to leave ordinary words alone). Without a shirt number: "een speler".
 */
export function withoutNames(
  text: string,
  players: { shirt_number: number | null; first_name: string; last_name: string }[],
  unknown: string,
): string {
  const terms: { pattern: string; flags: string; label: string }[] = [];
  for (const p of players) {
    const label = p.shirt_number === null ? unknown : `#${p.shirt_number}`;
    const first = p.first_name.trim();
    const last = p.last_name.trim();
    if (first && last) {
      terms.push({ pattern: `${escape(first)}\\s+${escape(last)}`, flags: "giu", label });
      terms.push({ pattern: `${escape(last)}\\s+${escape(first)}`, flags: "giu", label });
    }
    for (const name of [last, first]) if (name.length >= 2) terms.push({ pattern: escape(name), flags: "gu", label });
  }
  terms.sort((a, b) => b.pattern.length - a.pattern.length);
  return terms.reduce(
    (out, t) => out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${t.pattern}(?![\\p{L}\\p{N}])`, t.flags), t.label),
    text,
  );
}
