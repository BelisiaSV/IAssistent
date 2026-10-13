import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

/**
 * Validated public env. Read lazily (at request time), so `next build` does not
 * fail when a variable is missing, and the error names exactly what to set.
 */
export function getEnv(): PublicEnv {
  if (cached) return cached;
  // Explicit references so Next.js can inline NEXT_PUBLIC_* values.
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => String(i.path[0])))];
    throw new Error(
      `Missing or invalid environment variables: ${names.join(", ")}. ` +
        "Set them in apps/web/.env.local (local) or in Vercel → Settings → Environment Variables.",
    );
  }
  cached = result.data;
  return cached;
}
