"use client";

import type { Database } from "@iassistent/db";
import { createBrowserClient } from "@supabase/ssr";

/** Supabase client in the browser, only for direct uploads (e.g. large videos to a signed upload URL). */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
