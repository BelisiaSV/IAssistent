# @iassistent/db

TypeScript-types van het Supabase-schema en kleine gedeelde helpers.

`src/database.types.ts` volgt het formaat van `supabase gen types`. Na elke migratie
opnieuw genereren tegen een lokale Supabase (Docker nodig):

```bash
supabase start && supabase db reset
pnpm --filter @iassistent/db gen:types
```

Zonder Docker: pas de types met de hand aan en houd ze in lijn met `supabase/migrations`.
