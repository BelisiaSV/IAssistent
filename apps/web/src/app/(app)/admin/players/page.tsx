import { notFound } from "next/navigation";

import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { messages } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

import { ImportForm } from "./import-form";

const m = messages.playerImport;

/** Admin only: import players from the Excel template into a team. */
export default async function AdminPlayersPage() {
  await requireUser();
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();
  const { data: teams } = await supabase.rpc("admin_teams");

  return (
    <div className="space-y-4">
      <div className="max-w-2xl space-y-1">
        <h1 className="text-2xl font-semibold">{m.title}</h1>
        <p className="text-sm text-slate-600">{m.intro}</p>
      </div>
      <ImportForm teams={teams ?? []} />
    </div>
  );
}
