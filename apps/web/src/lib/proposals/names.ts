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
