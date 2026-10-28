import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Whether the signed-in user is a platform admin (set by hand in `platform_admins`). */
export async function isPlatformAdmin(supabase: Supabase): Promise<boolean> {
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}
