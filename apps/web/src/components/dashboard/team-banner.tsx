import { readableOn, shade } from "@/lib/proposals/overview";

/** Header of every team page in the team colours: crest, club and team. */
export function TeamBanner({
  team,
  logoUrl,
}: {
  team: { name: string; club_name: string; season: string | null; primary_color: string; secondary_color: string };
  logoUrl: string | null;
}) {
  const primary = team.primary_color;
  return (
    <div
      className="flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4 shadow-sm sm:px-6 print:hidden"
      style={{
        color: readableOn(primary),
        backgroundColor: primary,
        backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 16px), linear-gradient(115deg, ${primary} 0%, ${shade(primary, 0.4)} 100%)`,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1.5 shadow-md" />
      ) : (
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-md"
          style={{ backgroundColor: team.secondary_color, color: readableOn(team.secondary_color) }}
        >
          {team.club_name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-75">
          {team.name}
          {team.season ? ` · ${team.season}` : ""}
        </p>
        <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{team.club_name}</h1>
      </div>
      <span className="ml-auto hidden h-10 w-1.5 rounded-full sm:block" style={{ backgroundColor: team.secondary_color }} />
    </div>
  );
}
