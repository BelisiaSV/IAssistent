import { TEAM_LOGOS_BUCKET } from "@iassistent/db";

import { Sidebar } from "@/components/sidebar";
import type { SwitcherTeam } from "@/components/team-switcher";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
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
    <div className="min-h-screen lg:pl-64 print:pl-0">
      <Sidebar teams={switcherTeams} admin={admin} email={user.email ?? ""} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
