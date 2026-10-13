import "server-only";

import type { FeatureFlagKey } from "@iassistent/db";

import { createClient } from "@/lib/supabase/server";

/** Is a feature flag enabled for the logged-in coach (or one of their clubs)? */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_feature_enabled", { p_key: key });
  if (error) return false;
  return data === true;
}
