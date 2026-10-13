/** Only allow relative, same-origin redirect targets. */
export function safeNextPath(next: string | null | undefined, fallback = "/teams") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
