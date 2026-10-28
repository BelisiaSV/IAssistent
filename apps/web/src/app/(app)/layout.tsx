import { TEAM_LOGOS_BUCKET } from "@iassistent/db";
import Link from "next/link";

import { NavLink } from "@/components/nav-link";
import { type SwitcherTeam, TeamSwitcher } from "@/components/team-switcher";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const [admin, { data: teams }] = await Promise.all([
    isPlatformAdmin(supabase),
    supabase.from("teams").select("id, name, club_name, logo_path, primary_color, archived_at").order("created_at", { ascending: false }),
  ]);

  const logoPaths = (teams ?? []).flatMap((t) => (t.logo_path ? [t.logo_path] : []));
  const logoUrls = new Map<string, string>();
  if (logoPaths.length) {
    const { data } = await supabase.storage.from(TEAM_LOGOS_BUCKET).createSignedUrls(logoPaths, 3600);
    for (const item of data ?? []) if (item.path && item.signedUrl) logoUrls.set(item.path, item.signedUrl);
  }
  const switcherTeams: SwitcherTeam[] = (teams ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    clubName: t.club_name,
    logoUrl: t.logo_path ? (logoUrls.get(t.logo_path) ?? null) : null,
    primaryColor: t.primary_color,
    archived: !!t.archived_at,
  }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-slate-900 text-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <Link href="/teams" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-sm font-black text-slate-900">
              IA
            </span>
            <span className="hidden sm:inline">{messages.app.name}</span>
          </Link>
          <TeamSwitcher teams={switcherTeams} />
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <NavLink href="/exercises">{messages.nav.exercises}</NavLink>
            <NavLink href="/profile/vision">{messages.nav.vision}</NavLink>
            {admin && <NavLink href="/admin/players">{messages.playerImport.nav}</NavLink>}
            <span className="mx-2 hidden h-5 w-px bg-white/15 md:block" />
            <span className="hidden max-w-48 truncate text-slate-400 lg:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="rounded-md px-2.5 py-1.5 text-slate-300 hover:bg-white/10 hover:text-white">
                {messages.nav.signOut}
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
